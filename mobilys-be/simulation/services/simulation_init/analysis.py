# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import csv
import io
import logging
from collections import defaultdict
from datetime import date as dt_date

from gtfs.models import Calendar, CalendarDates, StopTimes, Stops, Trips
from gtfs.utils.route_data_utils import RouteDataUtils
from simulation.models import Simulation
from simulation.services.base import log_service_call
from simulation.services.simulation_init.csv_utils import _get_scenario_obj, _parse_date_flexible

@log_service_call
def analyze_ic_csv_against_simulation(uploaded_file, *, simulation: Simulation) -> dict:
    """
    Inspect an IC CSV upload against the simulation's original/duplicated scenarios.
    Returns details about invalid rows and trip count differences between scenarios
    at the ROUTE PATTERN level (route_id + direction_id + service_id + pattern_hash).
    """
    result = {
        "invalid_rows": [],
        "valid_trip_count": 0,
        "invalid_trip_count": 0,
        "trip_count_comparisons": [],
        "all_trip_counts_equal": True,
        "service_date": None,
        "service_ids": [],
    }

    if not uploaded_file or not simulation:
        return result

    original = _get_scenario_obj(simulation.original_scenario)
    duplicated = _get_scenario_obj(simulation.duplicated_scenario)
    if not original or not duplicated:
        return result

    uploaded_file.seek(0)
    try:
        raw = uploaded_file.read()
        if isinstance(raw, bytes):
            text = None
            for enc in ("utf-8-sig", "utf-8", "cp932", "shift_jis", "euc_jp"):
                try:
                    text = raw.decode(enc)
                    break
                except Exception:
                    continue
            if text is None:
                text = raw.decode("latin1", errors="ignore")
        else:
            text = raw
    except Exception:
        uploaded_file.seek(0)
        return result

    f = io.StringIO(text)
    try:
        reader = csv.DictReader(f)
    except Exception:
        uploaded_file.seek(0)
        return result

    rows: list[dict] = []
    trip_ids: set[str] = set()
    route_order: list[str] = []
    seen_routes: set[str] = set()
    dates: set[dt_date] = set()

    for idx, row in enumerate(reader, start=2):
        trip_id = (row.get("trip_id") or "").strip()
        route_id = (row.get("route_id") or "").strip()
        date_raw = (row.get("date") or "").strip()
        parsed_date = _parse_date_flexible(date_raw)
        if hasattr(parsed_date, "date"):
            parsed_date = parsed_date.date()

        rows.append({
            "row_number": idx,
            "trip_id": trip_id,
            "route_id": route_id,
            "date": parsed_date,
        })
        if trip_id:
            trip_ids.add(trip_id)
        if isinstance(parsed_date, dt_date):
            dates.add(parsed_date)
        if route_id and route_id not in seen_routes:
            seen_routes.add(route_id)
            route_order.append(route_id)

    uploaded_file.seek(0)

    if not rows or not trip_ids:
        return result

    # Extract service_date for response
    if dates:
        result["service_date"] = min(dates).isoformat()

    def _fetch_trip_map(scn_obj):
        """Fetch trip info including direction_id for pattern grouping."""
        trip_map = {}
        if not scn_obj:
            return trip_map
        qs = Trips.objects.filter(
            scenario=scn_obj,
            trip_id__in=list(trip_ids)
        ).values("trip_id", "route_id", "service_id", "direction_id")
        for item in qs:
            tid = (item.get("trip_id") or "").strip()
            if tid:
                trip_map[tid] = {
                    "route_id": (item.get("route_id") or "").strip(),
                    "service_id": (item.get("service_id") or "").strip(),
                    "direction_id": item.get("direction_id"),
                }
        return trip_map

    original_trip_map = _fetch_trip_map(original)
    duplicated_trip_map = _fetch_trip_map(duplicated)

    def _active_services_by_date(scn_obj):
        active = {d: set() for d in dates}
        if not scn_obj or not dates:
            return active

        calendars = Calendar.objects.filter(
            scenario=scn_obj,
            start_date__lte=max(dates),
            end_date__gte=min(dates)
        )
        for cal in calendars:
            flags = [cal.monday, cal.tuesday, cal.wednesday,
                     cal.thursday, cal.friday, cal.saturday, cal.sunday]
            for d in dates:
                if cal.start_date <= d <= cal.end_date and flags[d.weekday()]:
                    active.setdefault(d, set()).add(cal.service_id)

        cdates = CalendarDates.objects.filter(scenario=scn_obj, date__in=list(dates))
        for ex in cdates:
            if ex.exception_type == 1:
                active.setdefault(ex.date, set()).add(ex.service_id)
            elif ex.exception_type == 2:
                active.setdefault(ex.date, set()).discard(ex.service_id)
        return active

    original_active = _active_services_by_date(original)
    duplicated_active = _active_services_by_date(duplicated)

    invalid_rows = []
    valid_entries = []

    for row in rows:
        trip_id = row["trip_id"]
        route_id = row["route_id"]
        parsed_date = row["date"]
        issues = []

        orig_info = original_trip_map.get(trip_id)
        dup_info = duplicated_trip_map.get(trip_id)

        if not orig_info:
            issues.append({"type": "便が存在しません", "scenario": "現行シナリオ"})
        if not dup_info:
            issues.append({"type": "便が存在しません", "scenario": "将来シナリオ"})

        if orig_info and route_id and orig_info.get("route_id") and orig_info["route_id"] != route_id:
            issues.append({
                "type": "路線が異なります",
                "scenario": "現行シナリオ",
                "expected_route_id": orig_info.get("route_id"),
            })
        if dup_info and route_id and dup_info.get("route_id") and dup_info["route_id"] != route_id:
            issues.append({
                "type": "路線が異なります",
                "scenario": "将来シナリオ",
                "expected_route_id": dup_info.get("route_id"),
            })

        if isinstance(parsed_date, dt_date):
            if orig_info:
                sid = orig_info.get("service_id")
                if sid and sid not in original_active.get(parsed_date, set()):
                    issues.append({
                        "type": "サービスが非アクティブです",
                        "scenario": "現行シナリオ",
                        "service_id": sid
                    })
            if dup_info:
                sid = dup_info.get("service_id")
                if sid and sid not in duplicated_active.get(parsed_date, set()):
                    issues.append({
                        "type": "サービスが非アクティブです",
                        "scenario": "将来シナリオ",
                        "service_id": sid
                    })

        if issues:
            invalid_rows.append({
                "row_number": row["row_number"],
                "trip_id": trip_id,
                "route_id": route_id,
                "issues": issues,
            })
        else:
            valid_entries.append({
                "trip_id": trip_id,
                "route_id": route_id,
                "date": parsed_date.isoformat() if isinstance(parsed_date, dt_date) else None,
                "original_service_id": (orig_info or {}).get("service_id"),
                "original_direction_id": (orig_info or {}).get("direction_id"),
                "duplicated_service_id": (dup_info or {}).get("service_id"),
                "duplicated_direction_id": (dup_info or {}).get("direction_id"),
            })

    result["invalid_rows"] = invalid_rows
    result["invalid_trip_count"] = len(invalid_rows)
    result["valid_trip_count"] = len(valid_entries)

    if not valid_entries:
        return result

    # Collect service_ids from valid entries
    all_service_ids = set()
    for entry in valid_entries:
        if entry.get("original_service_id"):
            all_service_ids.add(entry["original_service_id"])
        if entry.get("duplicated_service_id"):
            all_service_ids.add(entry["duplicated_service_id"])
    result["service_ids"] = sorted(list(all_service_ids))

    valid_route_ids = {entry["route_id"] for entry in valid_entries}
    route_ids = [rid for rid in route_order if rid in valid_route_ids]
    if not route_ids:
        return result

    # ========== BUILD PATTERN-LEVEL COMPARISON ==========
    def _build_pattern_data(scn_obj, route_ids_list, service_ids_filter):
        """
        Build pattern data for a scenario.
        Returns: 
            pattern_trips: dict keyed by (route_id, direction_id, service_id, pattern_hash) -> list of trip_ids
            pattern_first_last: dict keyed by same key -> (first_stop_id, last_stop_id)
            pattern_direction_generated: dict keyed by same key -> bool (is_direction_id_generated)
        """
        if not scn_obj:
            return {}, {}, {}

        # Get all trips for these routes and services (include is_direction_id_generated)
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

        # Bulk fetch stop_times for pattern_hash computation
        stop_times = list(
            StopTimes.objects.filter(
                scenario=scn_obj,
                trip_id__in=trip_ids_all
            ).order_by("trip_id", "stop_sequence").values("trip_id", "stop_id")
        )

        # Group stop_ids by trip_id
        trip_stop_ids = defaultdict(list)
        for st in stop_times:
            trip_stop_ids[st["trip_id"]].append(str(st["stop_id"]))

        # Compute pattern_hash for each trip
        trip_pattern_hash = {}
        for trip_id, stop_ids in trip_stop_ids.items():
            if stop_ids:
                trip_pattern_hash[trip_id] = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)
            else:
                trip_pattern_hash[trip_id] = None

        # Build pattern groups
        pattern_trips = defaultdict(list)
        pattern_first_last = {}
        pattern_direction_generated = {}

        for t in trips_list:
            tid = t["trip_id"]
            ph = trip_pattern_hash.get(tid)
            key = (t["route_id"], t["direction_id"], t["service_id"], ph)
            pattern_trips[key].append(tid)

            # Track first/last stop for label
            stop_ids = trip_stop_ids.get(tid, [])
            if stop_ids and key not in pattern_first_last:
                pattern_first_last[key] = (stop_ids[0], stop_ids[-1])

            # Track is_direction_id_generated (use first occurrence)
            if key not in pattern_direction_generated:
                pattern_direction_generated[key] = t.get("is_direction_id_generated", False)

        return pattern_trips, pattern_first_last, pattern_direction_generated

    orig_services = {e["original_service_id"] for e in valid_entries if e.get("original_service_id")}
    dup_services = {e["duplicated_service_id"] for e in valid_entries if e.get("duplicated_service_id")}

    orig_pattern_trips, orig_first_last, orig_dir_generated = _build_pattern_data(original, route_ids, orig_services)
    dup_pattern_trips, dup_first_last, dup_dir_generated = _build_pattern_data(duplicated, route_ids, dup_services)

    # Get stop names for first/last stops
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

    # Collect all pattern keys
    all_keys = set(orig_pattern_trips.keys()) | set(dup_pattern_trips.keys())

    # Sort keys by route_id order, then direction_id, service_id, pattern_hash
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

    # Build comparisons at pattern level
    comparisons = []
    for key in sorted_keys:
        route_id, direction_id, service_id, pattern_hash = key

        orig_count = len(orig_pattern_trips.get(key, []))
        dup_count = len(dup_pattern_trips.get(key, []))
        diff = dup_count - orig_count

        if diff != 0:
            result["all_trip_counts_equal"] = False

        # Get first/last stop name
        first_last = orig_first_last.get(key) or dup_first_last.get(key)
        first_last_label = ""
        if first_last:
            first_name = stop_id_to_name.get(first_last[0], first_last[0])
            last_name = stop_id_to_name.get(first_last[1], first_last[1])
            first_last_label = f"{first_name} - {last_name}"

        # Get is_direction_id_generated (prefer original, fallback to duplicated)
        is_direction_id_generated = orig_dir_generated.get(key) or dup_dir_generated.get(key, False)

        # Create pattern_id
        pattern_id = RouteDataUtils.make_pattern_id(
            route_id, pattern_hash, direction_id, service_id
        )

        comparisons.append({
            "route_id": route_id,
            "direction_id": direction_id,
            "is_direction_id_generated": is_direction_id_generated,  # <-- NEW FIELD
            "service_id": service_id,
            "pattern_hash": pattern_hash,
            "pattern_id": pattern_id,
            "first_and_last_stop_name": first_last_label,
            "original_trip_count": orig_count,
            "duplicated_trip_count": dup_count,
            "difference": diff,
        })

    result["trip_count_comparisons"] = comparisons
    return result
