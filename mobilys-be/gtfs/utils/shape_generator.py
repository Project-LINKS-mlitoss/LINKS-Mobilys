# utils/shape_generator.py

from typing import Optional, Tuple, Iterable, List, Dict
import requests

from django.db import transaction, connection
from django.db.models import Q
from ..models import StopTimes, Stops, Shape, Trips, Scenario


class ShapeGenerator:
    """
    Utility to create & reuse shapes.txt from stop_times/stops data.
    Reuse occurs if the stop_id order (signature) is identical in the same scenario.
    
    ROUTING STRATEGY:
    - Bus (route_type=3): Uses OSRM road routing
    - Non-bus (rail, subway, tram, etc.): Uses straight line (PostGIS-style)
    
    VALIDATION:
    - Checks if shape_id in Trips actually exists in Shape table
    - Generates missing shapes even if trip has shape_id assigned
    """

    # =========================
    # --------- BATCH ---------
    # =========================

    @staticmethod
    def process_create_shapes_all_data(scenario_id: int) -> None:
        """
        Generate shapes for all Trips in the scenario that do not have a shape_id
        OR have shape_id but the shape doesn't exist in Shape table.
        """
        trips_qs = Trips.objects.filter(scenario_id=scenario_id)
        for t in trips_qs.only('trip_id', 'shape_id'):
            ShapeGenerator.assign_shape_for_single_trip(t.trip_id, scenario_id)

    @staticmethod
    def process_create_shapes_data_from_database_by_route(routes: Iterable[str], scenario_id: int) -> None:
        """
        Generate shapes for all Trips (in selected routes) that need shapes.
        Param 'routes' can be a list of route objects (with .route_id) or list[str].
        """
        if not routes:
            return

        # Normalize to list of route_id strings
        if hasattr(routes, '__getitem__') and len(routes) > 0 and hasattr(routes[0], 'route_id'):
            route_ids = [r.route_id for r in routes]
        else:
            route_ids = list(routes)

        trips_qs = Trips.objects.filter(
            scenario_id=scenario_id,
            route_id__in=route_ids
        )
        for t in trips_qs.only('trip_id', 'shape_id'):
            ShapeGenerator.assign_shape_for_single_trip(t.trip_id, scenario_id)

    @staticmethod
    def process_create_shapes_data_from_database_by_trips(trips: Iterable, scenario_id: int) -> None:
        """
        Generate shapes for a specific set of trips that need shapes.
        Param 'trips' can be a list of Trip objects or list[str] (trip_id).
        """
        if not trips:
            return

        if hasattr(trips, '__getitem__') and len(trips) > 0 and hasattr(trips[0], 'trip_id'):
            trip_ids = [t.trip_id for t in trips]
        else:
            trip_ids = list(trips)

        for trip_id in trip_ids:
            ShapeGenerator.assign_shape_for_single_trip(trip_id, scenario_id)

    # ==================================
    # --------- SIGNATURE/REUSE --------
    # ==================================

    @staticmethod
    def compute_trip_signature(trip_id: str, scenario_id: int) -> str:
        """
        Signature = stop_id order for 1 trip (in the same scenario).
        """
        stop_ids = (
            StopTimes.objects
            .filter(trip_id=trip_id, scenario_id=scenario_id)
            .order_by('stop_sequence')
            .values_list('stop_id', flat=True)
        )
        return '|'.join(stop_ids)

    @staticmethod
    def build_signature_to_shape_map(scenario_id: int) -> Dict[str, str]:
        """
        Build a map: signature -> shape_id from all trips that ALREADY have a VALID shape_id
        (shape_id that actually exists in Shape table).
        """
        sig_to_shape: Dict[str, str] = {}

        trips_with_shape = (
            Trips.objects
            .filter(scenario_id=scenario_id)
            .exclude(Q(shape_id__isnull=True) | Q(shape_id=''))
            .only('trip_id', 'shape_id')
        )

        # Get all existing shape_ids in Shape table for this scenario
        existing_shape_ids = set(
            Shape.objects
            .filter(scenario_id=scenario_id)
            .values_list('shape_id', flat=True)
            .distinct()
        )

        for t in trips_with_shape:
            # Only include if shape actually exists
            if t.shape_id not in existing_shape_ids:
                continue
                
            stop_ids = (
                StopTimes.objects
                .filter(trip_id=t.trip_id, scenario_id=scenario_id)
                .order_by('stop_sequence')
                .values_list('stop_id', flat=True)
            )
            if not stop_ids:
                continue
            signature = '|'.join(stop_ids)
            sig_to_shape.setdefault(signature, t.shape_id)

        return sig_to_shape

    # ================================
    # --------- SINGLE TRIP ----------
    # ================================

    @staticmethod
    def assign_shape_for_single_trip(trip_or_id, scenario_id: int) -> Tuple[Optional[str], str]:
        """
        Assign shape_id for 1 trip with validation:
          - "skipped"       : if the trip has a valid shape_id (exists in Shape table)
          - "reused"        : if a matching signature is found -> use existing shape_id
          - "created"       : if not found -> generate a new shape
          - "created_fixed" : if trip had shape_id but it didn't exist -> generate with that shape_id
          - "skipped"       : if insufficient data
        
        Return: (shape_id | None, status)
        """
        with transaction.atomic():
            # Lock the trip row to prevent race conditions
            if isinstance(trip_or_id, Trips):
                trip = (
                    Trips.objects
                    .select_for_update()
                    .get(pk=trip_or_id.pk, scenario_id=scenario_id)
                )
            else:
                trip = (
                    Trips.objects
                    .select_for_update()
                    .get(trip_id=trip_or_id, scenario_id=scenario_id)
                )

            # Check if trip has shape_id AND if it exists in Shape table
            existing_shape_id = None
            if trip.shape_id:
                shape_exists = Shape.objects.filter(
                    scenario_id=scenario_id,
                    shape_id=trip.shape_id
                ).exists()
                
                if shape_exists:
                    # Shape ID exists and is valid -> skip
                    return trip.shape_id, "skipped"
                else:
                    # Shape ID exists in trip but not in Shape table
                    # We'll use this shape_id when creating
                    existing_shape_id = trip.shape_id

            # Compute signature for this trip
            signature = ShapeGenerator.compute_trip_signature(trip.trip_id, scenario_id)
            if not signature:
                return None, "skipped"

            # Try to reuse from other trips with valid shapes
            sig_to_shape = ShapeGenerator.build_signature_to_shape_map(scenario_id)
            reused_shape_id = sig_to_shape.get(signature)
            if reused_shape_id:
                Trips.objects.filter(pk=trip.pk).update(shape_id=reused_shape_id)
                return reused_shape_id, "reused"

            # Generate new shape
            stop_times_qs = (
                StopTimes.objects
                .filter(trip_id=trip.trip_id, scenario_id=scenario_id)
                .order_by('stop_sequence')
            )
            if not stop_times_qs.exists():
                return None, "skipped"

            stop_ids = list(stop_times_qs.values_list('stop_id', flat=True))
            stops_qs = Stops.objects.filter(stop_id__in=stop_ids, scenario_id=scenario_id)

            coordinates = ShapeGenerator.get_coordinates_from_trip(trip.trip_id, stop_times_qs, stops_qs)
            if not coordinates:
                return None, "skipped"

            # Get route_type to determine routing strategy
            route_type = ShapeGenerator.get_route_type_from_trip(trip.trip_id, scenario_id)
            
            # Generate shape based on route_type
            shape_coords = ShapeGenerator.generate_shape_from_coordinates(coordinates, route_type)
            if not shape_coords:
                return None, "skipped"

            # Determine which shape_id to use:
            # 1. If trip already had a shape_id (but it didn't exist), use that
            # 2. Otherwise, use trip_id as shape_id
            if existing_shape_id:
                new_shape_id = existing_shape_id
                status = "created_fixed"
            else:
                new_shape_id = trip.trip_id
                status = "created"

            shapes_to_create: List[Shape] = []
            for seq, (lon, lat) in enumerate(shape_coords, start=1):
                shapes_to_create.append(Shape(
                    scenario_id=scenario_id,
                    shape_id=new_shape_id,
                    shape_pt_lat=float(lat),
                    shape_pt_lon=float(lon),
                    shape_pt_sequence=seq,
                    shape_dist_traveled=0.0
                ))

            # Insert all shape points
            Shape.objects.bulk_create(shapes_to_create)

            # Update trip with shape_id if it didn't have one
            if not existing_shape_id:
                Trips.objects.filter(pk=trip.pk).update(shape_id=new_shape_id)

            return new_shape_id, status

    # ==================================
    # --------- COORD GENERATOR --------
    # ==================================

    @staticmethod
    def get_route_type_from_trip(trip_id: str, scenario_id: int) -> int:
        """
        Get route_type for a trip to determine routing strategy.
        Returns route_type (default: 3 for bus if not found).
        
        Route types:
        0: Tram, 1: Subway, 2: Rail, 3: Bus, 4: Ferry, 5: Cable car, 6: Gondola, 7: Funicular
        """
        try:
            trip = Trips.objects.filter(trip_id=trip_id, scenario_id=scenario_id).first()
            if not trip:
                return 3  # default to bus
            
            from ..models import Routes
            route = Routes.objects.filter(route_id=trip.route_id, scenario_id=scenario_id).first()
            return route.route_type if route else 3
        except Exception:
            return 3  # default to bus on error

    @staticmethod
    def get_routed_coordinates_from_stops(scenario_id: int, stop_ids: Iterable[str], route_type: int = 3) -> List[List[float]]:
        """
        Get coordinates for each stop, then request routing based on route_type.
        - Bus (route_type=3): Uses OSRM road routing
        - Non-bus: Uses straight line connection
        """
        stops_by_id = {
            s.stop_id: s
            for s in Stops.objects.filter(stop_id__in=stop_ids, scenario_id=scenario_id)
        }
        coords: List[List[float]] = []
        for sid in stop_ids:
            st = stops_by_id.get(sid)
            if st and hasattr(st, 'stop_lat') and hasattr(st, 'stop_lon'):
                coords.append([float(st.stop_lon), float(st.stop_lat)])

        if len(coords) < 2:
            return []

        try:
            return ShapeGenerator.generate_shape_from_coordinates(coords, route_type)
        except Exception:
            return coords

    @staticmethod
    def get_coordinates_from_trip(trip_id: str, stop_times_list, stops_list) -> List[List[float]]:
        if hasattr(stop_times_list, 'filter'):
            st_iter = list(stop_times_list)
        else:
            st_iter = [st for st in stop_times_list if st.trip_id == trip_id]

        st_pairs: List[Tuple[str, int]] = [(st.stop_id, st.stop_sequence) for st in st_iter]
        st_pairs.sort(key=lambda x: x[1])

        if not st_pairs:
            return []

        stops_map = {}
        if hasattr(stops_list, 'values_list'):
            for sid, lon, lat in stops_list.values_list('stop_id', 'stop_lon', 'stop_lat'):
                if sid not in stops_map and lon is not None and lat is not None:
                    stops_map[sid] = (float(lon), float(lat))
        else:
            for s in stops_list:
                if getattr(s, 'stop_id', None) is None:
                    continue
                if s.stop_id not in stops_map and hasattr(s, 'stop_lon') and hasattr(s, 'stop_lat'):
                    stops_map[s.stop_id] = (float(s.stop_lon), float(s.stop_lat))

        coords: List[List[float]] = []
        for sid, _seq in st_pairs:
            p = stops_map.get(sid)
            if p:
                lon, lat = p
                coords.append([lon, lat])

        return coords

    @staticmethod
    def generate_shape_from_coordinates(coordinates: List[List[float]], route_type: int = 3) -> List[List[float]]:
        """
        Generate shape coordinates based on route_type:
        - Bus (route_type=3): Uses OSRM road routing
        - Non-bus (0,1,2,4,5,6,7): Uses straight line with interpolation (PostGIS-style)
        
        Returns list of [lon, lat] coordinates.
        """
        if not coordinates or len(coordinates) < 2:
            return []

        # For bus routes, use OSRM routing
        if route_type == 3:
            return ShapeGenerator._generate_osrm_route(coordinates)
        
        # For non-bus routes (rail, subway, tram, ferry, etc.), use straight line with interpolation
        return ShapeGenerator._generate_straight_line_route(coordinates)

    @staticmethod
    def _generate_osrm_route(coordinates: List[List[float]]) -> List[List[float]]:
        """
        Request OSRM polyline (overview=simplified) for bus routes.
        Raises Exception if failed.
        """
        coord_string = ";".join([f"{lon},{lat}" for lon, lat in coordinates])
        url = f"http://router.project-osrm.org/route/v1/driving/{coord_string}?overview=simplified&geometries=geojson"
        
        try:
            resp = requests.get(url, timeout=20)
            if resp.status_code != 200:
                raise Exception("Error fetching route data from OSRM")
            
            data = resp.json()
            return data['routes'][0]['geometry']['coordinates']
        except Exception as e:
            raise Exception(f"OSRM routing failed: {str(e)}")

    @staticmethod
    def _generate_straight_line_route(coordinates: List[List[float]], points_per_segment: int = 5) -> List[List[float]]:
        """
        Generate straight line route with interpolation between stops.
        This simulates what PostGIS ST_MakeLine would do.
        
        Args:
            coordinates: List of [lon, lat] pairs
            points_per_segment: Number of interpolated points between each pair of stops
        
        Returns:
            List of interpolated [lon, lat] coordinates
        """
        if len(coordinates) < 2:
            return coordinates
        
        result = []
        
        for i in range(len(coordinates) - 1):
            lon1, lat1 = coordinates[i]
            lon2, lat2 = coordinates[i + 1]
            
            # Add the starting point
            result.append([lon1, lat1])
            
            # Interpolate points between stops
            for j in range(1, points_per_segment):
                ratio = j / points_per_segment
                interp_lon = lon1 + (lon2 - lon1) * ratio
                interp_lat = lat1 + (lat2 - lat1) * ratio
                result.append([interp_lon, interp_lat])
        
        # Add the final point
        result.append(coordinates[-1])
        
        return result

    @staticmethod
    def _generate_straight_line_route_postgis(coordinates: List[List[float]]) -> List[List[float]]:
        """
        Alternative: Generate straight line route using PostGIS ST_MakeLine.
        This requires PostGIS extension to be installed in your database.
        
        NOTE: This is an alternative to _generate_straight_line_route that uses actual PostGIS.
        Use this if you want true PostGIS integration.
        """
        if len(coordinates) < 2:
            return coordinates
        
        # Build WKT LINESTRING
        points_wkt = ', '.join([f"{lon} {lat}" for lon, lat in coordinates])
        linestring_wkt = f"LINESTRING({points_wkt})"
        
        # Use PostGIS to generate interpolated points
        with connection.cursor() as cursor:
            # ST_Segmentize adds vertices to a geometry so no vertices are further apart than the given distance
            # Adjust 0.001 (roughly 100m) based on your needs
            cursor.execute("""
                SELECT ST_AsText(
                    ST_Segmentize(
                        ST_GeomFromText(%s, 4326),
                        0.001
                    )
                )
            """, [linestring_wkt])
            
            result = cursor.fetchone()[0]
            
            # Parse the result back to coordinates
            # Result format: "LINESTRING(lon1 lat1, lon2 lat2, ...)"
            coords_str = result.replace('LINESTRING(', '').replace(')', '')
            coord_pairs = coords_str.split(', ')
            
            return [[float(lon), float(lat)] for lon, lat in 
                    [pair.split(' ') for pair in coord_pairs]]

    # ==============================
    # --------- HOUSEKEEPING -------
    # ==============================

    @staticmethod
    def delete_shape_id_that_not_used_in_trip(scenario_id: int) -> int:
        """
        Delete all Shape (in the scenario) whose shape_id is not used by any Trip.
        Return: number of Shape rows deleted.
        """
        used_shape_ids = list(
            Trips.objects
            .filter(scenario_id=scenario_id)
            .exclude(Q(shape_id__isnull=True) | Q(shape_id=''))
            .values_list('shape_id', flat=True)
            .distinct()
        )
        deleted, _ = (
            Shape.objects
            .filter(scenario_id=scenario_id)
            .exclude(shape_id__in=used_shape_ids)
            .delete()
        )
        return deleted

    @staticmethod
    def validate_and_fix_orphaned_shape_ids(scenario_id: int) -> Dict[str, int]:
        """
        Find and fix trips that have shape_id but the shape doesn't exist in Shape table.
        
        Returns:
            Dictionary with statistics:
            - 'orphaned_found': Number of trips with invalid shape_ids
            - 'shapes_created': Number of shapes successfully created
            - 'shapes_failed': Number of shapes that failed to create
        """
        stats = {
            'orphaned_found': 0,
            'shapes_created': 0,
            'shapes_failed': 0
        }
        
        # Get all trips with shape_id
        trips_with_shape = Trips.objects.filter(
            scenario_id=scenario_id
        ).exclude(
            Q(shape_id__isnull=True) | Q(shape_id='')
        ).only('trip_id', 'shape_id')
        
        # Get all existing shape_ids
        existing_shape_ids = set(
            Shape.objects
            .filter(scenario_id=scenario_id)
            .values_list('shape_id', flat=True)
            .distinct()
        )
        
        # Find orphaned trips
        for trip in trips_with_shape:
            if trip.shape_id not in existing_shape_ids:
                stats['orphaned_found'] += 1
                
                # Try to generate shape for this trip
                shape_id, status = ShapeGenerator.assign_shape_for_single_trip(
                    trip.trip_id, 
                    scenario_id
                )
                
                if shape_id and status in ['created', 'created_fixed', 'reused']:
                    stats['shapes_created'] += 1
                else:
                    stats['shapes_failed'] += 1
        
        return stats
    

    @staticmethod
    def generate_shape_from_stops(
        stops: List[Dict],
        route_type: int = 3,
        coordinate_keys: Tuple[str, str] = ('stop_lon', 'stop_lat')
    ) -> List[Dict]:
        """
        Generate shape data from a list of stops without database access.
        This is a standalone utility method.
        
        Args:
            stops: List of stop dictionaries with coordinate fields.
                Example: [
                    {'stop_id': 'S1', 'stop_lat': 35.6812, 'stop_lon': 139.7671},
                    {'stop_id': 'S2', 'stop_lat': 35.6895, 'stop_lon': 139.6917},
                ]
            route_type: GTFS route type (default 3 for bus)
                        - 3 (Bus): Uses OSRM road routing
                        - Others (0,1,2,4,5,6,7): Uses straight line interpolation
            coordinate_keys: Tuple of (lon_key, lat_key) for extracting coordinates
                            Default: ('stop_lon', 'stop_lat')
        
        Returns:
            List of shape point dictionaries ready for shapes.txt:
            [
                {'shape_pt_lat': 35.6812, 'shape_pt_lon': 139.7671, 'shape_pt_sequence': 1, 'shape_dist_traveled': 0.0},
                {'shape_pt_lat': 35.6850, 'shape_pt_lon': 139.7300, 'shape_pt_sequence': 2, 'shape_dist_traveled': 0.0},
                ...
            ]
        
        Raises:
            ValueError: If stops list is empty or has insufficient data
        """
        if not stops or len(stops) < 2:
            raise ValueError("At least 2 stops are required to generate a shape")
        
        lon_key, lat_key = coordinate_keys
        
        # Extract coordinates from stops
        coordinates: List[List[float]] = []
        for stop in stops:
            lon = stop.get(lon_key)
            lat = stop.get(lat_key)
            
            if lon is None or lat is None:
                continue
                
            coordinates.append([float(lon), float(lat)])
        
        if len(coordinates) < 2:
            raise ValueError("At least 2 stops with valid coordinates are required")
        
        # Generate shape based on route_type
        shape_coords = ShapeGenerator.generate_shape_from_coordinates(coordinates, route_type)
        
        if not shape_coords:
            raise ValueError("Failed to generate shape coordinates")
        
        # Convert to shape point dictionaries
        shape_points: List[Dict] = []
        for seq, (lon, lat) in enumerate(shape_coords, start=1):
            shape_points.append({
                'shape_pt_lat': float(lat),
                'shape_pt_lon': float(lon),
                'shape_pt_sequence': seq,
                'shape_dist_traveled': 0.0
            })
        
        return shape_points


    @staticmethod
    def generate_shape_from_coordinates_only(
        coordinates: List[Tuple[float, float]],
        route_type: int = 3,
        coord_format: str = 'lon_lat'
    ) -> List[Dict]:
        """
        Generate shape data from raw coordinates without database access.
        Even simpler version - just pass coordinates directly.
        
        Args:
            coordinates: List of coordinate tuples
                        Example: [(139.7671, 35.6812), (139.6917, 35.6895)]
            route_type: GTFS route type (default 3 for bus)
            coord_format: 'lon_lat' or 'lat_lon' to specify input order
        
        Returns:
            List of shape point dictionaries ready for shapes.txt
        
        Raises:
            ValueError: If coordinates list is empty or has insufficient data
        """
        if not coordinates or len(coordinates) < 2:
            raise ValueError("At least 2 coordinates are required to generate a shape")
        
        # Normalize coordinates to [lon, lat] format
        if coord_format == 'lat_lon':
            coords = [[float(lon), float(lat)] for lat, lon in coordinates]
        else:
            coords = [[float(lon), float(lat)] for lon, lat in coordinates]
        
        # Generate shape
        shape_coords = ShapeGenerator.generate_shape_from_coordinates(coords, route_type)
        
        if not shape_coords:
            raise ValueError("Failed to generate shape coordinates")
        
        # Convert to shape point dictionaries
        shape_points: List[Dict] = []
        for seq, (lon, lat) in enumerate(shape_coords, start=1):
            shape_points.append({
                'shape_pt_lat': float(lat),
                'shape_pt_lon': float(lon),
                'shape_pt_sequence': seq,
                'shape_dist_traveled': 0.0
            })
        
        return shape_points