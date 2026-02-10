from collections import defaultdict, OrderedDict
from ..models import Trips, StopTimes, Stops, RouteKeywordMap
from .route_data_utils import RouteDataUtils
from gtfs.utils.route_group_sorter import route_id_sort_key
import locale
import string

def _to_seconds(t):
    """
    Convert 'HH:MM:SS' (or time-like) to seconds for sorting.
    Unknown/empty values are pushed to the end.
    """
    if not t:
        return float("inf")
    try:
        # accept datetime.time or string
        s = t.strftime("%H:%M:%S") if hasattr(t, "strftime") else str(t)
        hh, mm, ss = (s.split(":") + ["0", "0", "0"])[:3]
        # strip microseconds if present
        ss = ss.split(".")[0]
        return int(hh) * 3600 + int(mm) * 60 + int(ss)
    except Exception:
        return float("inf")


class TripDataUtils:
    
    locale.setlocale(locale.LC_COLLATE, 'ja_JP.UTF-8')

    @staticmethod
    def build_route_patterns_structure(routes, trips, stop_times, stops):
        route_map = {r.route_id: r for r in routes}

        # trips grouped by route_id
        trips_by_route = defaultdict(list)
        for trip in trips:
            trips_by_route[trip.route_id].append(trip)

        # stop_times lookups
        stop_times_map = defaultdict(list)
        for st in stop_times:
            stop_times_map[st.trip_id].append(st)
        stop_name_map = {s.stop_id: s.stop_name for s in stops}

        scenario_id = getattr(next(iter(routes), None), "scenario_id", None)
        route_ids_with_trips = set(trips_by_route.keys())

        label_by_route = {}
        if scenario_id and route_ids_with_trips:
            for m in RouteKeywordMap.objects.select_related("keyword")\
                    .filter(scenario_id=scenario_id, route_id__in=route_ids_with_trips):
                label_by_route[m.route_id] = m.keyword.keyword if m.keyword_id else ""

        sorted_route_ids = sorted(
            route_ids_with_trips,
            key=lambda rid: route_id_sort_key(label_by_route.get(rid, "")),
        )

        result = []
        for route_id in sorted_route_ids:
            route = route_map.get(route_id)
            r_trips = trips_by_route[route_id]

            route_short_name = getattr(route, "route_short_name", route_id)
            route_long_name = getattr(route, "route_long_name", "")
            route_type = getattr(route, "route_type", None)
            agency_id = getattr(route, "agency_id", None)

            pattern_map = OrderedDict()
            for trip in r_trips:
                # ----- Build canonical stop sequence for THIS trip -----
                sts = stop_times_map.get(trip.trip_id, [])
                sts_sorted = sorted(sts, key=lambda x: x.stop_sequence)

                # If no stop_times, skip this trip
                if not sts_sorted:
                    continue
                stop_ids = [str(st.stop_id) for st in sts_sorted]
                stop_hash = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)

                # Pattern key: stop_hash + direction_id + service_id
                key = (stop_hash, trip.direction_id, trip.service_id)

                if key not in pattern_map:
                    pid = RouteDataUtils.make_pattern_id(
                        route_id,
                        stop_hash,
                        trip.direction_id,
                        trip.service_id,
                    )

                    # Headways (first stop name - last stop name)
                    first_name = stop_name_map.get(sts_sorted[0].stop_id, "")
                    last_name  = stop_name_map.get(sts_sorted[-1].stop_id, "")
                    headways   = f"{first_name} - {last_name}" if sts_sorted else ""

                    pattern_map[key] = {
                        "pattern_id":   pid,
                        "shape_id":     trip.shape_id,  # still exposed for reference
                        "direction_id": trip.direction_id,
                        "service_id":   trip.service_id,
                        "headways":     headways,
                        "trips":        [],
                    }

                # First departure from the sorted list + force "HH:MM:SS"
                first = sts_sorted[0]
                departure = (
                    first.departure_time.strftime("%H:%M:%S")
                    if hasattr(first.departure_time, "strftime")
                    else str(first.departure_time)
                )

                pattern_map[key]["trips"].append({
                    "trip_id":                   trip.trip_id,
                    "service_id":                trip.service_id,
                    "trip_headsign":             trip.trip_headsign,
                    "trip_short_name":           getattr(trip, "trip_short_name", trip.trip_id),
                    "shape_id":                  trip.shape_id,
                    "direction_id":              trip.direction_id,
                    "departure_time":            departure,
                    "is_direction_id_generated": getattr(trip, "is_direction_id_generated", False),
                })

            # Sort patterns by pattern_id with the SAME key for stability
            patterns_sorted = sorted(
                pattern_map.values(),
                key=lambda p: route_id_sort_key(p.get("pattern_id") or ""),
            )

            result.append({
                "route_id":         route_id,
                "route_short_name": route_short_name,
                "route_long_name":  route_long_name,
                "route_type":       route_type,
                "agency_id":        agency_id,
                "route_patterns":   patterns_sorted,
            })

        return result

    @staticmethod
    def check_duplicate_trip(trip_data, scenario_id=None, trip_id=None):
        """
        Check if a trip with the same scenario_id, service_id, direction_id,
        and identical stop_times exists in the database (excluding current trip_id).

        Args:
            trip_data (dict): The trip data containing:
                - service_id
                - direction_id
                - stop_times: list of dicts with stop_id, arrival_time, departure_time
            scenario_id (str): Scenario ID for filtering.
            trip_id (str): Current trip_id to exclude from check.

        Returns:
            bool: True if duplicate exists, False otherwise
        """
        updated_service_id = trip_data.get('service_id')
        updated_direction_id = trip_data.get('direction_id')
        updated_stop_times = trip_data.get('stop_times', [])

        # Query other trips in same scenario with same service_id and direction_id
        other_trips = Trips.objects.filter(
            scenario_id=scenario_id,
            service_id=updated_service_id,
            direction_id=updated_direction_id
        )

        # Exclude current trip_id if provided
        if trip_id:
            other_trips = other_trips.exclude(trip_id=trip_id)

        for other_trip in other_trips:
            # Fetch stop_times for this other_trip
            other_stop_times_qs = StopTimes.objects.filter(
                trip_id=other_trip.trip_id,
            ).order_by('stop_sequence')

            other_stop_times = list(other_stop_times_qs.values(
                'stop_sequence', 'stop_id', 'arrival_time', 'departure_time'
            ))

            # Quick length check
            if len(other_stop_times) != len(updated_stop_times):
                continue

            # Compare each stop_time entry
            duplicate = True
            for i in range(len(updated_stop_times)):
                u = updated_stop_times[i]
                o = other_stop_times[i]

                if (
                    u['stop_id'] != o['stop_id']
                    or str(u['arrival_time']) != str(o['arrival_time'])
                    or str(u['departure_time']) != str(o['departure_time'])
                ):
                    duplicate = False
                    break

            if duplicate:
                # Duplicate found, return True immediately
                return True

        return False

    @staticmethod
    def check_create_duplicate_trip(trip_data, scenario_id=None):
        """
        Check if a trip with the same scenario_id, service_id, direction_id,
        and identical stop_times exists in the database.

        Args:
            trip_data (dict): The trip data containing:
                - scenario_id
                - service_id
                - direction_id
                - stop_times: list of dicts with stop_id, arrival_time, departure_time

        Returns:
            bool: True if duplicate exists, False otherwise
        """
        updated_service_id = trip_data.get('service_id')
        updated_direction_id = trip_data.get('direction_id')
        updated_stop_times = trip_data.get('stop_times', [])
        trip_id = trip_data.get('trip_id')

        other_trips = Trips.objects.filter(
            scenario_id=scenario_id,
            service_id=updated_service_id,
            direction_id=updated_direction_id
        ).exclude(trip_id=trip_id)

        for other_trip in other_trips:
            # Fetch stop_times for this other_trip
            other_stop_times_qs = StopTimes.objects.filter(
                trip_id=other_trip.trip_id,
            ).order_by('stop_sequence')

            other_stop_times = list(other_stop_times_qs.values(
                'stop_sequence', 'stop_id', 'arrival_time', 'departure_time'
            ))

            # Quick length check
            if len(other_stop_times) != len(updated_stop_times):
                continue

            # Compare each stop_time entry
            duplicate = True
            for i in range(len(updated_stop_times)):
                u = updated_stop_times[i]
                o = other_stop_times[i]

                if (
                    u['stop_id'] != o['stop_id']
                    or str(u['arrival_time']) != str(o['arrival_time'])
                    or str(u['departure_time']) != str(o['departure_time'])
                ):
                    duplicate = False
                    break

            if duplicate:
                # Duplicate found, return True with duplicate trip_id for logging
                return True
            

        return False 
