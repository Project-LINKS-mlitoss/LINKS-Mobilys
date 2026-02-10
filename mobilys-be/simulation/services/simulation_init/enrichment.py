from collections import defaultdict

from gtfs.models import StopTimes, Stops, Trips
from gtfs.utils.route_data_utils import RouteDataUtils
from simulation.models import Simulation
from simulation.services.base import log_service_call
from simulation.services.simulation_init.csv_utils import _get_scenario_obj

@log_service_call
def enrich_validation_result_with_patterns(result_json: dict, simulation: Simulation) -> dict:
    """
    Enrich old validation results that lack pattern-level data.
    Detects old format and re-computes pattern info from database.
    """
    comparisons = result_json.get("trip_count_comparisons", [])
    
    # Check if already has pattern data (new format)
    if comparisons and "pattern_id" in comparisons[0]:
        return result_json  # Already enriched
    
    # No comparisons to enrich
    if not comparisons:
        return result_json
    
    original = _get_scenario_obj(simulation.original_scenario)
    duplicated = _get_scenario_obj(simulation.duplicated_scenario)
    
    if not original or not duplicated:
        return result_json
    
    # Collect all route_ids and service_ids from old comparisons
    route_ids = []
    seen_routes = set()
    all_service_ids = set()
    
    for cmp in comparisons:
        rid = cmp.get("route_id")
        if rid and rid not in seen_routes:
            seen_routes.add(rid)
            route_ids.append(rid)
        # Old format had services_original/services_duplicated as arrays
        for sid in (cmp.get("services_original") or []):
            all_service_ids.add(sid)
        for sid in (cmp.get("services_duplicated") or []):
            all_service_ids.add(sid)
    
    if not route_ids:
        return result_json
    
    # Build pattern data for both scenarios
    def _build_pattern_data(scn_obj, route_ids_list, service_ids_filter):
        if not scn_obj:
            return {}, {}, {}
        
        trips_qs = Trips.objects.filter(
            scenario=scn_obj,
            route_id__in=route_ids_list,
        )
        if service_ids_filter:
            trips_qs = trips_qs.filter(service_id__in=list(service_ids_filter))
        
        trips_list = list(trips_qs.values(
            "trip_id", "route_id", "service_id", "direction_id", "is_direction_id_generated"
        ))
        trip_ids_all = [t["trip_id"] for t in trips_list]
        
        if not trip_ids_all:
            return {}, {}, {}
        
        stop_times = list(
            StopTimes.objects.filter(
                scenario=scn_obj,
                trip_id__in=trip_ids_all
            ).order_by("trip_id", "stop_sequence").values("trip_id", "stop_id")
        )
        
        trip_stop_ids = defaultdict(list)
        for st in stop_times:
            trip_stop_ids[st["trip_id"]].append(str(st["stop_id"]))
        
        trip_pattern_hash = {}
        for trip_id, stop_ids in trip_stop_ids.items():
            if stop_ids:
                trip_pattern_hash[trip_id] = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)
            else:
                trip_pattern_hash[trip_id] = None
        
        pattern_trips = defaultdict(list)
        pattern_first_last = {}
        pattern_direction_generated = {}
        
        for t in trips_list:
            tid = t["trip_id"]
            ph = trip_pattern_hash.get(tid)
            key = (t["route_id"], t["direction_id"], t["service_id"], ph)
            pattern_trips[key].append(tid)
            
            stop_ids = trip_stop_ids.get(tid, [])
            if stop_ids and key not in pattern_first_last:
                pattern_first_last[key] = (stop_ids[0], stop_ids[-1])
            
            if key not in pattern_direction_generated:
                pattern_direction_generated[key] = t.get("is_direction_id_generated", False)
        
        return pattern_trips, pattern_first_last, pattern_direction_generated
    
    orig_pattern_trips, orig_first_last, orig_dir_generated = _build_pattern_data(
        original, route_ids, all_service_ids
    )
    dup_pattern_trips, dup_first_last, dup_dir_generated = _build_pattern_data(
        duplicated, route_ids, all_service_ids
    )
    
    # Get stop names
    all_stop_ids = set()
    for (first, last) in list(orig_first_last.values()) + list(dup_first_last.values()):
        all_stop_ids.add(first)
        all_stop_ids.add(last)
    
    stop_id_to_name = {}
    if all_stop_ids:
        for scn in [original, duplicated]:
            if scn:
                for s in Stops.objects.filter(scenario=scn, stop_id__in=list(all_stop_ids)):
                    if s.stop_id not in stop_id_to_name:
                        stop_id_to_name[s.stop_id] = s.stop_name
    
    # Build new comparisons
    all_keys = set(orig_pattern_trips.keys()) | set(dup_pattern_trips.keys())
    
    def key_sort(k):
        route_id, direction_id, service_id, pattern_hash = k
        route_idx = route_ids.index(route_id) if route_id in route_ids else 9999
        return (
            route_idx,
            direction_id is None,
            direction_id if direction_id is not None else 999,
            service_id or "",
            pattern_hash or "",
        )
    
    sorted_keys = sorted(all_keys, key=key_sort)
    
    new_comparisons = []
    all_equal = True
    
    for key in sorted_keys:
        route_id, direction_id, service_id, pattern_hash = key
        
        orig_count = len(orig_pattern_trips.get(key, []))
        dup_count = len(dup_pattern_trips.get(key, []))
        diff = dup_count - orig_count
        
        if diff != 0:
            all_equal = False
        
        first_last = orig_first_last.get(key) or dup_first_last.get(key)
        first_last_label = ""
        if first_last:
            first_name = stop_id_to_name.get(first_last[0], first_last[0])
            last_name = stop_id_to_name.get(first_last[1], first_last[1])
            first_last_label = f"{first_name} - {last_name}"
        
        is_direction_id_generated = orig_dir_generated.get(key) or dup_dir_generated.get(key, False)
        
        pattern_id = RouteDataUtils.make_pattern_id(
            route_id, pattern_hash, direction_id, service_id
        )
        
        new_comparisons.append({
            "route_id": route_id,
            "direction_id": direction_id,
            "is_direction_id_generated": is_direction_id_generated,
            "service_id": service_id,
            "pattern_hash": pattern_hash,
            "pattern_id": pattern_id,
            "first_and_last_stop_name": first_last_label,
            "original_trip_count": orig_count,
            "duplicated_trip_count": dup_count,
            "difference": diff,
        })
    
    # Update result
    enriched = result_json.copy()
    enriched["trip_count_comparisons"] = new_comparisons
    enriched["all_trip_counts_equal"] = all_equal
    
    return enriched
