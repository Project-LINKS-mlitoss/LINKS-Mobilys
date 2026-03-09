# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict, OrderedDict
from ..models import Routes, Trips, StopTimes
from django.utils import timezone
import math
from .shape_generator import ShapeGenerator
import uuid
import locale
import string
from ..models import Trips, StopTimes, Shape, Routes, RouteKeywords, RouteKeywordMap
from django.db import transaction
import hashlib
from itertools import groupby
from operator import itemgetter
from gtfs.utils.route_group_sorter import route_id_sort_key

class RouteDataUtils:

    @staticmethod
    def _compute_pattern_hash_from_ids(stop_ids):
        s = '|'.join(map(str, stop_ids))
        return hashlib.sha1(s.encode('utf-8')).hexdigest()

    @staticmethod
    def _extract_stop_ids_from_payload(pattern: dict):
        if isinstance(pattern.get('stop_ids'), list) and pattern['stop_ids']:
            return [str(x) for x in pattern['stop_ids']]
        seq = pattern.get('stop_sequence')
        if isinstance(seq, list) and seq:
            return [str(x['stop_id']) for x in sorted(seq, key=lambda d: int(d['stop_sequence']))]
        return []

    @staticmethod
    def _trip_stop_ids_bulk(scenario_id, trip_ids):
        if not trip_ids:
            return {}
        rows = (
            StopTimes.objects
            .filter(scenario_id=scenario_id, trip_id__in=trip_ids)
            .order_by('trip_id', 'stop_sequence')
            .values_list('trip_id', 'stop_id')
        )
        out = {}
        for tid, group in groupby(rows, key=itemgetter(0)):
            out[tid] = [stop_id for _, stop_id in group]
        return out
    # Set Japanese locale for proper collation
    locale.setlocale(locale.LC_COLLATE, 'ja_JP.UTF-8')

    @staticmethod
    def make_pattern_id(route_id, shape_id, direction_id, service_id):

        raw = f"{route_id}|{shape_id}|{direction_id}|{service_id}"
        digest = hashlib.md5(raw.encode("utf-8")).hexdigest()[:8]
        return f"{route_id}-{digest}"

    # Static method to calculate the Haversine distance between two coordinates
    @staticmethod
    def haversine(coord1, coord2):
        R = 6371  # Earth radius in km
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Static method to generate route patterns from GTFS data
    @staticmethod
    def get_route_pattern(routes, trips, stop_times, stops, shapes):
        # --- build lookups ---
        trips_by_route = defaultdict(list)
        for t in trips:
            trips_by_route[t.route_id].append(t)

        stop_times_map = defaultdict(list)
        for st in stop_times:
            stop_times_map[st.trip_id].append(st)

        stop_name_map = {s.stop_id: s.stop_name for s in stops}
        stop_coord_map = {s.stop_id: [float(s.stop_lat), float(s.stop_lon)] for s in stops}

        shape_map = defaultdict(list)
        for sh in sorted(shapes, key=lambda s: (s.shape_id, s.shape_pt_sequence)):
            shape_map[sh.shape_id].append([float(sh.shape_pt_lat), float(sh.shape_pt_lon)])

        # --- sort ROUTES by their keyword (not by route_id) ---
        route_ids = [r.route_id for r in routes]
        # get scenario_id from the first route (they all share the same in this call)
        scenario_id = getattr(next(iter(routes), None), "scenario_id", None)

        label_by_route = {}
        if scenario_id is not None and route_ids:
            for m in RouteKeywordMap.objects.select_related("keyword") \
                    .filter(scenario_id=scenario_id, route_id__in=route_ids):
                label_by_route[m.route_id] = m.keyword.keyword if m.keyword_id else ""

        routes_sorted = sorted(
            routes,
            key=lambda r: route_id_sort_key(label_by_route.get(r.route_id, "")),
        )

        # --- assemble result ---
        result = []
        for route in routes_sorted:
            rid = route.route_id
            tlist = trips_by_route.get(rid, [])
            if not tlist:
                continue

            r_short = getattr(route, "route_short_name", rid)
            r_long = getattr(route, "route_long_name", "")
            r_type = getattr(route, "route_type", None)
            agency = getattr(route, "agency_id", None)

            pattern_map = OrderedDict()

            for trip in tlist:
                # 1) Build canonical stop sequence for THIS trip
                sts_sorted = sorted(
                    stop_times_map[trip.trip_id],
                    key=lambda x: x.stop_sequence
                )

                if not sts_sorted:
                    continue

                stop_sequence = [
                    {
                        "stop_id":       st.stop_id,
                        "stop_name":     stop_name_map.get(st.stop_id, ""),
                        "stop_sequence": st.stop_sequence,
                        "latlng":        stop_coord_map.get(st.stop_id, []),
                    }
                    for st in sts_sorted
                ]

                # 2) Canonical stop_ids list and hash (this is what delete compares)
                stop_ids = [str(st.stop_id) for st in sts_sorted]
                stop_hash = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)

                # 3) Pattern key is now based on stop sequence + direction + service,
                #    which matches delete_route_pattern's hashing logic.
                key = (stop_hash, trip.direction_id, trip.service_id)

                if key not in pattern_map:
                    # pattern_id just needs to be stable & unique per pattern;
                    # we can reuse make_pattern_id but feed it stop_hash instead of shape_id.
                    pid = RouteDataUtils.make_pattern_id(
                        rid,
                        stop_hash,  # was trip.shape_id before
                        trip.direction_id,
                        trip.service_id,
                    )

                    first_name = stop_name_map.get(sts_sorted[0].stop_id, "") if sts_sorted else ""
                    last_name = stop_name_map.get(sts_sorted[-1].stop_id, "") if sts_sorted else ""
                    segment = f"{first_name} - {last_name}" if sts_sorted else ""

                    pattern_map[key] = {
                        "pattern_id":                pid,
                        "shape_id":                  trip.shape_id,  # still exposed for map
                        "direction_id":              trip.direction_id,
                        "service_id":                trip.service_id,
                        "segment":                   segment,
                        "stop_sequence":             stop_sequence,
                        "stop_ids":                  stop_ids,        # <– NEW: delete uses this
                        "shape":                     shape_map.get(trip.shape_id, []),
                        "is_direction_id_generated": bool(getattr(trip, "is_direction_id_generated", False)),
                    }
                else:
                    if getattr(trip, "is_direction_id_generated", False):
                        pattern_map[key]["is_direction_id_generated"] = True

            # sort patterns by pattern_id with the SAME key for stability
            patterns_sorted = sorted(
                pattern_map.values(),
                key=lambda p: route_id_sort_key(p.get("pattern_id") or ""),
            )

            result.append({
                "route_id":         rid,
                "route_short_name": r_short,
                "route_long_name":  r_long,
                "route_type":       r_type,
                "agency_id":        agency,
                "patterns":         patterns_sorted,
            })

        return result

    # Static method to create a route pattern in the database
    @staticmethod
    def create_route_pattern(scenario_id, route_data, trip_data, stop_sequence):
        route_id = route_data['route_id']
        agency_id = route_data['agency_id']
        route_short_name = route_data['route_short_name']
        route_long_name = route_data.get('route_long_name', '')
        route_type = route_data['route_type']

        service_id = trip_data['service_id']
        direction_id = trip_data['direction_id']

        # Ensure atomicity for route + keyword + map + trip/stoptimes
        with transaction.atomic():
            # 1) Create the route
            Routes.objects.create(
                scenario_id=scenario_id,
                route_id=route_id,
                agency_id=agency_id,
                route_short_name=route_short_name,
                route_long_name=route_long_name,
                route_type=route_type,
            )

            # 2) Ensure a route_keywords row exists for this scenario/route_id
            kw_defaults = {}
            try:
                color = RouteDataUtils._color_from_text(route_id)  # optional helper
                kw_defaults["keyword_color"] = color
            except Exception:
                pass

            keyword_obj, _ = RouteKeywords.objects.get_or_create(
                scenario_id=scenario_id,
                keyword=route_id,
                defaults=kw_defaults,
            )

            # 3) Ensure a route_keyword_map row exists linking this route to that keyword
            map_kwargs = dict(
                scenario_id=scenario_id,
                route_id=route_id,
                keyword=keyword_obj,  # FK
            )
            RouteKeywordMap.objects.get_or_create(
                **map_kwargs,
                defaults={"can_automatically_update": True},
            )
            
            first_stop = stop_sequence[0]
            last_stop = stop_sequence[-1]
            departure_time_obj = timezone.datetime(2025, 1, 1, 8, 0)
            departure_jp_time = departure_time_obj.strftime("%H時%M分")
            first_stop_headsign = f"系統{first_stop['stop_id'].split('_')[0]}"
            trip_id = f"{service_id}_{departure_jp_time}_{first_stop_headsign}_{uuid.uuid4().hex[:6]}"
            trip_headsign = last_stop['name']

            Trips.objects.create(
                scenario_id=scenario_id,
                route_id=route_id,
                service_id=service_id,
                trip_id=trip_id,
                trip_headsign=trip_headsign,
                shape_id='',
                direction_id=direction_id
            )

            current_time = departure_time_obj
            average_speed_kmph = 30

            for i, stop in enumerate(stop_sequence):
                stop_id = stop['stop_id']
                lat1, lon1 = stop['latlng']

                arrival_str = current_time.strftime('%H:%M:%S')
                departure_str = arrival_str  # Make arrival and departure time the same

                StopTimes.objects.create(
                    scenario_id=scenario_id,
                    trip_id=trip_id,
                    arrival_time=arrival_str,
                    departure_time=departure_str,
                    stop_id=stop_id,
                    stop_sequence=i + 1,
                    # stop_headsign=trip_headsign,
                    pickup_type=0,
                    drop_off_type=0,
                )

                # Only increment current_time for the next stop
                if i < len(stop_sequence) - 1:
                    lat2, lon2 = stop_sequence[i + 1]['latlng']
                    distance_km = RouteDataUtils.haversine((lat1, lon1), (lat2, lon2))
                    travel_minutes_float = (distance_km / average_speed_kmph) * 60
                    travel_minutes = int(travel_minutes_float)
                    if travel_minutes_float - travel_minutes >= 0.5:
                        travel_minutes += 1
                    current_time = current_time + timezone.timedelta(minutes=travel_minutes)

            # After creating StopTimes, call shape generator
            trip_obj = Trips.objects.get(trip_id=trip_id, scenario_id=scenario_id)
            ShapeGenerator.process_create_shapes_data_from_database_by_trips([trip_obj], scenario_id)

        return trip_id

    # Static method to delete route patterns based on provided criteria
    @staticmethod
    @transaction.atomic
    def delete_route_pattern(scenario_id, route_patterns):
        if not scenario_id:
            raise ValueError("scenario_id is required")

        if not isinstance(route_patterns, list):
            raise ValueError("route_patterns must be a list of dictionaries")

        deleted_trip_ids = set()
        touched_shape_ids = set()
        touched_route_ids = set()

        for pattern in route_patterns:
            route_id = pattern.get("route_id")
            direction_id = pattern.get("direction_id")
            service_id = pattern.get("service_id")

            if not route_id or direction_id is None or not service_id:
                # skip incomplete entries
                continue

            # Candidate trips for the triple (include shape_id)
            candidates_qs = (
                Trips.objects
                .filter(
                    scenario_id=scenario_id,
                    route_id=route_id,
                    direction_id=direction_id,
                    service_id=service_id,
                )
                .values("trip_id", "shape_id")
            )

            candidates = list(candidates_qs)
            if not candidates:
                continue

            candidate_ids = [c["trip_id"] for c in candidates]

            # Exact match by stop sequence hash if UI provided stop ids
            stop_ids_from_ui = RouteDataUtils._extract_stop_ids_from_payload(pattern)
            if stop_ids_from_ui:
                target_hash = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids_from_ui)
                by_trip_ids = RouteDataUtils._trip_stop_ids_bulk(scenario_id, candidate_ids)
                to_delete_ids = [
                    tid for tid, ids in by_trip_ids.items()
                    if RouteDataUtils._compute_pattern_hash_from_ids(ids) == target_hash
                ]
            else:
                # Fallback: delete all candidates for the triple
                to_delete_ids = candidate_ids

            if not to_delete_ids:
                continue

            # Track route and shapes used by trips to delete (before deletion)
            touched_route_ids.add(route_id)
            for c in candidates:
                if c["trip_id"] in to_delete_ids and c["shape_id"]:
                    touched_shape_ids.add(c["shape_id"])

            # Delete stop_times first (if no FK cascade), then trips
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id__in=to_delete_ids).delete()
            Trips.objects.filter(scenario_id=scenario_id, trip_id__in=to_delete_ids).delete()

            deleted_trip_ids.update(to_delete_ids)

        # --- Post cleanup ---

        # 1) Remove orphan shapes (no remaining trips reference them in this scenario)
        if touched_shape_ids:
            still_used_shape_ids = set(
                Trips.objects
                .filter(scenario_id=scenario_id, shape_id__in=touched_shape_ids)
                .values_list("shape_id", flat=True)
            )
            orphan_shape_ids = list(touched_shape_ids - still_used_shape_ids)
            if orphan_shape_ids:
                Shape.objects.filter(scenario_id=scenario_id, shape_id__in=orphan_shape_ids).delete()

        # 2) For each touched route, if it has no more trips, remove keyword maps and the route row
        if touched_route_ids:
            # Only compute existence per route once
            for rid in touched_route_ids:
                if not Trips.objects.filter(scenario_id=scenario_id, route_id=rid).exists():
                    RouteKeywordMap.objects.filter(scenario_id=scenario_id, route_id=rid).delete()
                    Routes.objects.filter(scenario_id=scenario_id, route_id=rid).delete()

        return {
            "deleted_trip_ids": list(deleted_trip_ids),
            "message": f"{len(deleted_trip_ids)} trips deleted.",
            "error": False,
        }


    # Static method to create an existing route pattern based on provided trip data and stop sequence
    @staticmethod
    def create_existing_route_pattern(scenario_id, route_id, trip_data, stop_sequence):
        service_id = trip_data['service_id']
        direction_id = trip_data['direction_id']
        agency_id = trip_data.get('agency_id', '')

        first_stop = stop_sequence[0]
        last_stop = stop_sequence[-1]
        departure_time_obj = timezone.datetime(2025, 1, 1, 8, 0)
        departure_jp_time = departure_time_obj.strftime("%H時%M分")
        first_stop_headsign = f"系統{first_stop['stop_id'].split('_')[0]}"
        trip_id = f"{service_id}_{departure_jp_time}_{first_stop_headsign}_{uuid.uuid4().hex[:6]}"
        trip_headsign = last_stop['name']

        Trips.objects.create(
            scenario_id = scenario_id,
            route_id = route_id,
            service_id = service_id,
            trip_id = trip_id,
            trip_headsign = trip_headsign,
            shape_id = '',
            direction_id = direction_id,
        )

        current_time = departure_time_obj
        average_speed_kmph = 30

        for i, stop in enumerate(stop_sequence):
            stop_id = stop['stop_id']
            lat1, lon1 = stop['latlng']

            arrival_str = current_time.strftime('%H:%M:%S')
            departure_str = arrival_str  # Make arrival and departure time the same

            StopTimes.objects.create(
                scenario_id = scenario_id,
                trip_id = trip_id,
                arrival_time = arrival_str,
                departure_time = departure_str,
                stop_id = stop_id,
                stop_sequence = i + 1,
                # stop_headsign = trip_headsign,
                pickup_type = 0,
                drop_off_type = 0,
            )

            # Only increment current_time for the next stop
            if i < len(stop_sequence) - 1:
                lat2, lon2 = stop_sequence[i+1]['latlng']
                distance_km = RouteDataUtils.haversine((lat1, lon1), (lat2, lon2))
                travel_minutes_float = (distance_km / average_speed_kmph) * 60
                travel_minutes = int(travel_minutes_float)
                if travel_minutes_float - travel_minutes >= 0.5:
                    travel_minutes += 1
                current_time = current_time + timezone.timedelta(minutes=travel_minutes)

        ShapeGenerator.process_create_shapes_data_from_database_by_trips([trip_id], scenario_id)
        shape_exists = Shape.objects.filter(scenario_id = scenario_id, shape_id = trip_id).exists()
        if shape_exists:
            trip = Trips.objects.get(trip_id = trip_id, scenario_id= scenario_id)
            trip.shape_id = trip_id
            trip.save()

        return{
            "trip_id": trip_id,
            "message": "Route pattern created successfully"
        }

    # Static method to edit the stop sequence of a route pattern
    @staticmethod
    def edit_route_pattern_stop_sequence(scenario_id, route_id, direction_id, service_id, shape_id, new_stop_sequence):
        """
        Replace stop sequence for matching trips with exact sequence from request.
        """
        if not (scenario_id and route_id and service_id and new_stop_sequence):
            raise ValueError("Required parameters: scenario_id, route_id, service_id, and new_stop_sequence must be provided.")

        matching_trips = Trips.objects.filter(
            scenario_id=scenario_id,
            route_id=route_id,
            direction_id=direction_id,
            service_id=service_id,
            shape_id=shape_id
        )

        if not matching_trips.exists():
            raise ValueError("No matching trips found for the given parameters.")

        sample_trip = matching_trips.first()
        original_stop_times_map = {
            st.stop_id: st
            for st in StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id=sample_trip.trip_id
            )
        }

        new_stop_ids = [item['stop_id'] for item in new_stop_sequence]
        
        missing_stops = [sid for sid in new_stop_ids if sid not in original_stop_times_map]
        if missing_stops:
            raise ValueError(f"Stop IDs not found in original stop times: {missing_stops}")

        updated_trip_ids = []
        new_shape_id = None

        with transaction.atomic():
            trip_ids_to_update = list(matching_trips.values_list('trip_id', flat=True))
            
            StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id__in=trip_ids_to_update
            ).delete()

            new_stop_times = []
            for trip_id in trip_ids_to_update:
                for seq, item in enumerate(new_stop_sequence, start=1):
                    stop_id = item['stop_id']
                    original_st = original_stop_times_map[stop_id]
                    
                    new_stop_times.append(StopTimes(
                        scenario_id=scenario_id,
                        trip_id=trip_id,
                        stop_id=stop_id,
                        stop_sequence=seq,
                        arrival_time=original_st.arrival_time,
                        departure_time=original_st.departure_time,
                        pickup_type=original_st.pickup_type,
                        drop_off_type=original_st.drop_off_type,
                        stop_headsign=original_st.stop_headsign,
                        shape_dist_traveled=original_st.shape_dist_traveled,
                        timepoint=original_st.timepoint,
                        is_arrival_time_next_day=original_st.is_arrival_time_next_day,
                        is_departure_time_next_day=original_st.is_departure_time_next_day,
                    ))
            
            StopTimes.objects.bulk_create(new_stop_times)
            updated_trip_ids = trip_ids_to_update

            # Delete old shape from Shape table ONLY if no other trips are using it
            # This prevents shape point accumulation and scrambled shapes
            if shape_id:
                other_trips_using_shape = Trips.objects.filter(
                    scenario_id=scenario_id,
                    shape_id=shape_id
                ).exclude(trip_id__in=updated_trip_ids).exists()
                
                if not other_trips_using_shape:
                    Shape.objects.filter(scenario_id=scenario_id, shape_id=shape_id).delete()

            # Clear shape_id so ShapeGenerator excludes these trips from signature map
            Trips.objects.filter(
                scenario_id=scenario_id,
                trip_id__in=updated_trip_ids
            ).update(shape_id='')

            new_shape_id, _ = ShapeGenerator.assign_shape_for_single_trip(
                trip_or_id=updated_trip_ids[0],
                scenario_id=scenario_id
            )

            # Update ALL matching trips with the resolved shape_id
            if new_shape_id:
                Trips.objects.filter(
                    scenario_id=scenario_id,
                    trip_id__in=updated_trip_ids
                ).update(shape_id=new_shape_id)

        return {
            "message": "Stop sequence updated successfully.",
            "error": False,
            "data": {
                "edited_trip_ids": updated_trip_ids,
                "stops_count": len(new_stop_sequence),
                "total_trips_updated": len(updated_trip_ids),
                "new_shape_id": new_shape_id,
            }
        }

    # Static method to check for duplicate route patterns
    @staticmethod
    def check_duplicate_pattern(scenario_id, route_id, direction_id, service_id, stop_sequence, agency_id, route_type):
        candidate_trips = Trips.objects.filter(
            scenario_id=scenario_id,
            route_id=route_id,
            direction_id=direction_id,
            service_id=service_id
        )

        for trip in candidate_trips:

            qs = StopTimes.objects.filter(trip_id=trip.trip_id, scenario_id=scenario_id).order_by('stop_sequence').distinct('stop_sequence', 'stop_id')
            stop_times = list(qs)
            if len(stop_times) != len(stop_sequence):
                continue

            match = True
            for i, st in enumerate(stop_times):
                if (
                    st.stop_id != stop_sequence[i]["stop_id"]
                    #st.stop_sequence != stop_sequence[i]["stop_sequence"]
                ):
                    match = False
                    break

            if match:
                # Also compare agency and route_type
                route = Routes.objects.filter(scenario_id=scenario_id, route_id=route_id).first()
                if route and route.agency_id == agency_id and route.route_type == route_type:
                    return {
                        "exists": True,
                        "trip_id": trip.trip_id,
                        "shape_id": trip.shape_id, 
                        "message": "同じルートパターンは既存に存在しています。",
                    }

        return {"exists": False}

    # Static method to check for duplicate route IDs
    @staticmethod
    def check_duplicate_route_id(scenario_id, route_id):
        exists = Routes.objects.filter(scenario_id = scenario_id, route_id = route_id).exists()
        return {
            "exists": exists,
            "message": f"ルートID '{route_id}' は既存に存在しています" if exists else "",
        }

    @staticmethod
    def delete_route_group_by_id(scenario_id, route_group_id):
        """
        Delete a RouteKeywords group by its table ID if no routes are related to it via RouteKeywordMap.
        """
        if not scenario_id:
            return {"error": True, "message": "scenario_id is required"}
        if not route_group_id:
            return {"error": True, "message": "route_group (ID) is required"}

        # Find the RouteKeywords object by ID
        keyword_obj = RouteKeywords.objects.filter(scenario_id=scenario_id, id=route_group_id).first()
        if not keyword_obj:
            return {"error": True, "message": "RouteKeywords not found"}

        # Check for related routes in RouteKeywordMap
        related_routes = RouteKeywordMap.objects.filter(scenario_id=scenario_id, keyword=keyword_obj)
        if related_routes.exists():
            return {
                "error": True,
                "message": "Cannot delete: There are routes related to this keyword group.",
                "related_route_ids": list(related_routes.values_list("route_id", flat=True))
            }

        keyword_obj.delete()
        return {
            "error": False,
            "message": f"RouteKeywords ID '{route_group_id}' deleted successfully."
        }
