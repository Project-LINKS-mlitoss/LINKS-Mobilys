# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from dataclasses import dataclass
from datetime import datetime, timedelta, time as dtime
from collections import defaultdict
from typing import Dict, List, Tuple, Set, Optional

from rest_framework import status as http_status

from gtfs.models import (
    Scenario, Routes, Trips, StopTimes, Stops, Shape,
    StopNameKeywords, StopNameKeywordMap,
    StopIdKeyword, StopIdKeywordMap,
    RouteKeywords, RouteKeywordMap,
)
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages

def _parse_time_component(s: str) -> dtime:
    """Parse a HH:MM:SS string into a time object."""
    hh, mm, ss = map(int, s.strip().split(":"))
    return dtime(hh, mm, ss)

def _parse_time_range(start_str: Optional[str], end_str: Optional[str]) -> Tuple[Optional[dtime], Optional[dtime]]:
    """
    Parse time range. If both None -> (None, None).
    If only one provided -> raise ValueError (we require both).
    """
    if not start_str and not end_str:
        return None, None
    if not start_str or not end_str:
        raise ValueError(Messages.BA_BOTH_START_END_REQUIRED_EN)
    start_t = _parse_time_component(start_str)
    end_t = _parse_time_component(end_str)
    return start_t, end_t

def _time_in_range(t: Optional[dtime], start_t: Optional[dtime], end_t: Optional[dtime]) -> bool:
    """
    Inclusive range check. Supports cross-midnight (e.g., 23:00 -> 02:00).
    If no range specified -> True.
    """
    if not (start_t and end_t):
        return True
    if t is None:
        return False
    if start_t <= end_t:
        return start_t <= t <= end_t
    # cross-midnight
    return t >= start_t or t <= end_t

def _hour_bucket(t: Optional[dtime]) -> Optional[str]:
    """Convert a time to an hour bucket label."""
    if not t:
        return None
    return f"{t.hour:02d}:00:00"

def _to_time(val) -> Optional[dtime]:
    """Convert a value to a time object when possible."""
    if val is None:
        return None
    if isinstance(val, dtime):
        return val
    try:
        hh, mm, ss = map(int, str(val).split(":"))
        return dtime(hh, mm, ss)
    except Exception:
        return None

def _stats_from_series_map(d: Dict[str, int]) -> Dict[str, int | float]:
    """Compute average/maximum/total from a series map."""
    if not d:
        return {"average": 0, "maximum": 0, "total": 0}
    vals = list(d.values())
    total = sum(vals)
    return {"average": round(total / len(vals), 2), "maximum": int(max(vals)), "total": int(total)}

@dataclass
class GroupMeta:
    name: str
    lon: float
    lat: float

def _resolve_group_keys_for_keyword(scenario: Scenario, grouping_method: str, keyword: str) -> Set[str]:
    """Resolve grouping keys for a keyword based on grouping method."""
    if grouping_method == "stop_name":
        rows = StopNameKeywords.objects.filter(
            scenario=scenario, stop_name_keyword=keyword
        ).values("stop_group_id")
        return {f"name:{r['stop_group_id']}" for r in rows}

    if grouping_method == "stop_id":
        rows = StopIdKeyword.objects.filter(
            scenario=scenario, stop_id_keyword=keyword
        ).values_list("stop_group_id", flat=True)
        return {f"id:{gid}" for gid in rows}

    sids = Stops.objects.filter(scenario=scenario, stop_name=keyword)\
                        .values_list("stop_id", flat=True)
    return {f"stop:{sid}" for sid in sids}

def _routes_to_groups(scenario: Scenario, route_ids: Set[str]) -> List[str]:
    """Resolve route groups for a set of route ids."""
    if not RouteKeywordMap or not route_ids:
        return []
    try:
        qs = RouteKeywordMap.objects.filter(scenario=scenario, route_id__in=list(route_ids))\
                                    .values_list("keyword__keyword", flat=True).distinct()
        return sorted(set(qs))
    except Exception:
        return []


def _base_validate(body):
    """Validate common required fields for segment/stop analytics."""
    scenario_id = body.get("scenario_id")
    mode = (body.get("mode") or "").strip().lower()
    value_type = (body.get("type") or "in_car").strip().lower()
    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    if mode not in ("segment", "stop"):
        raise ServiceError(Messages.BA_MODE_INVALID_SPECIFY_JA, "invalid mode", http_status.HTTP_400_BAD_REQUEST)
    if value_type not in ("in_car", "boarding", "alighting"):
        raise ServiceError(Messages.BA_TYPE_INVALID_SPECIFY_JA, "invalid type", http_status.HTTP_400_BAD_REQUEST)
    return scenario_id, mode, value_type

def _selection_validate(scenario, mode, body, grouping_method):
    """Validate segment/stop selection payload and resolve group keys."""
    if mode == "segment":
        seg = body.get("segment") or {}
        if not isinstance(seg, dict) or not seg.get("from_keyword") or not seg.get("to_keyword"):
            raise ServiceError(Messages.BA_SEGMENT_FORMAT_REQUIRED_JA, "segment missing", http_status.HTTP_400_BAD_REQUEST)
        from_keys = _resolve_group_keys_for_keyword(scenario, grouping_method, seg["from_keyword"])
        to_keys   = _resolve_group_keys_for_keyword(scenario, grouping_method, seg["to_keyword"])
        if not from_keys:
            raise ServiceError(
                Messages.BA_FROM_KEYWORD_GROUP_NOT_FOUND_TEMPLATE_JA.format(from_keyword=seg["from_keyword"]),
                "from not found",
                http_status.HTTP_404_NOT_FOUND,
            )
        if not to_keys:
            raise ServiceError(
                Messages.BA_TO_KEYWORD_GROUP_NOT_FOUND_TEMPLATE_JA.format(to_keyword=seg["to_keyword"]),
                "to not found",
                http_status.HTTP_404_NOT_FOUND,
            )
        if len(from_keys) > 1 or len(to_keys) > 1:
            raise ServiceError(Messages.BA_AMBIGUOUS_KEYWORDS_JA, "ambiguous keywords", http_status.HTTP_400_BAD_REQUEST)
        return next(iter(from_keys)), next(iter(to_keys))

    stop_spec = body.get("stop") or {}
    if not isinstance(stop_spec, dict) or not stop_spec.get("keyword"):
        raise ServiceError(Messages.BA_STOP_FORMAT_REQUIRED_JA, "stop missing", http_status.HTTP_400_BAD_REQUEST)
    gkeys = _resolve_group_keys_for_keyword(scenario, grouping_method, stop_spec["keyword"])
    if not gkeys:
        raise ServiceError(
            Messages.BA_KEYWORD_STOP_GROUP_NOT_FOUND_TEMPLATE_JA.format(keyword=stop_spec["keyword"]),
            "keyword not found",
            http_status.HTTP_404_NOT_FOUND,
        )
    if len(gkeys) > 1:
        raise ServiceError(Messages.BA_AMBIGUOUS_KEYWORDS_JA, "ambiguous keyword", http_status.HTTP_400_BAD_REQUEST)
    return next(iter(gkeys)), None

def _load_materialized(scenario, routes_filter: Set[str] | None, rows: List[dict] | None):
    """Load Trips/StopTimes/Stops data for the scenario and filters."""
    trips_qs = Trips.objects.filter(scenario=scenario)
    if routes_filter:
        trips_qs = trips_qs.filter(route_id__in=list(routes_filter))
    trip_rows = list(trips_qs.values("trip_id", "route_id"))
    trip_map = {t["trip_id"]: t for t in trip_rows}

    trips_from_data = {r.get("trip_id") for r in (rows or []) if r.get("trip_id")}
    target_trips = (set(trip_map.keys()) & trips_from_data) if trips_from_data else set(trip_map.keys())

    st_qs = list(
        StopTimes.objects
        .filter(scenario=scenario, trip_id__in=list(target_trips))
        .values("trip_id", "stop_id", "stop_sequence", "departure_time", "arrival_time")
        .order_by("trip_id", "stop_sequence")
    )
    stop_ids = {row["stop_id"] for row in st_qs}
    stop_coord: Dict[str, Tuple[float, float, str]] = {}
    for s in Stops.objects.filter(scenario=scenario, stop_id__in=stop_ids)\
                          .values("stop_id", "stop_lon", "stop_lat", "stop_name"):
        stop_coord[s["stop_id"]] = (float(s["stop_lon"]), float(s["stop_lat"]), s["stop_name"])

    return trip_map, set(target_trips), st_qs, stop_ids, stop_coord

def _collect_occurrences(
    mode: str,
    gA: str,
    gB: Optional[str],
    grouping_method: str,
    st_qs: List[dict],
    trip_map: Dict[str, dict],
    scenario: Scenario,
    ):
    """
    Collect segment/stop occurrences with route and trip context.

    mode=segment: [(rid, tid, sidA, sidB, depA, arrB)]
    mode=stop   : [(rid, tid, sidX, depX, arrX)]
    """
    stop_ids = {row["stop_id"] for row in st_qs}
    group_key_by_stop: Dict[str, str] = {}
    if grouping_method == "stop_name":
        maps = StopNameKeywordMap.objects.filter(stop_id__in=stop_ids, scenario=scenario)\
                                         .values("stop_id", "stop_name_group_id")
        for m in maps:
            group_key_by_stop[m["stop_id"]] = f"name:{m['stop_name_group_id']}"
    elif grouping_method == "stop_id":
        maps = StopIdKeywordMap.objects.filter(stop_id__in=stop_ids, scenario=scenario)\
                                       .values("stop_id", "stop_id_group_id")
        for m in maps:
            group_key_by_stop[m["stop_id"]] = f"id:{m['stop_id_group_id']}"
    for sid in stop_ids:
        group_key_by_stop.setdefault(sid, f"stop:{sid}")

    trip_seq_rows: Dict[str, List[dict]] = defaultdict(list)
    for row in st_qs:
        trip_seq_rows[row["trip_id"]].append(row)

    if mode == "segment":
        occurs = []
        routes_seen: Set[str] = set()
        trips_seen: Set[str] = set()
        for tid, seq in trip_seq_rows.items():
            prev = None
            for row in seq:
                if prev is not None:
                    GA = group_key_by_stop.get(prev["stop_id"])
                    GB = group_key_by_stop.get(row["stop_id"])
                    if GA == gA and GB == gB:
                        rid = trip_map[tid]["route_id"]
                        occurs.append((rid, tid, prev["stop_id"], row["stop_id"],
                                       _to_time(prev["departure_time"]),
                                       _to_time(row["arrival_time"])))
                        routes_seen.add(rid); trips_seen.add(tid)
                prev = row
        return occurs, routes_seen, trips_seen

    # mode == "stop"
    occurs = []
    routes_seen: Set[str] = set()
    trips_seen: Set[str] = set()
    for tid, seq in trip_seq_rows.items():
        for row in seq:
            sid = row["stop_id"]
            if group_key_by_stop.get(sid) == gA:
                rid = trip_map[tid]["route_id"]
                occurs.append((rid, tid, sid, _to_time(row["departure_time"]), _to_time(row["arrival_time"])))
                routes_seen.add(rid); trips_seen.add(tid)
    return occurs, routes_seen, trips_seen

def _events_index(rows: List[dict], target_trips: Set[str], stop_ids: Set[str], top_date: Optional[str]):
    """Index event rows by trip and stop."""
    filtered_rows: List[dict] = []
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        if top_date and r.get("date") and r["date"] != top_date:
            continue
        filtered_rows.append(r)

    events_by_trip_stop: Dict[Tuple[str, str], Dict[str, int]] = defaultdict(lambda: {"on": 0, "off": 0})
    for r in filtered_rows:
        tid, sid = r.get("trip_id"), r.get("stop_id")
        if tid in target_trips and sid in stop_ids:
            events_by_trip_stop[(tid, sid)]["on"]  += int(r.get("count_geton")  or 0)
            events_by_trip_stop[(tid, sid)]["off"] += int(r.get("count_getoff") or 0)
    return events_by_trip_stop


def build_segment_stop_analytics(body):
    """
    Build time-series analytics for a segment or stop.

    Parameters:
    - body (dict): Request payload.
    - scenario_id (str): Scenario identifier.
    - mode (str): segment | stop.
    - type (str): in_car | boarding | alighting.
    - segment (dict|None): Segment selector for segment mode.
    - stop (dict|None): Stop selector for stop mode.
    - date (str|None): Service date (YYYYMMDD).
    - start_time (str|None): Start time (HH:MM:SS).
    - end_time (str|None): End time (HH:MM:SS).
    - route_groups (list[str]|None): Filter route groups.
    - routes (list[str]|None): Filter routes.
    - trips (list[str]|None): Filter trips.
    - data (list[dict]): Event rows.

    Returns:
    - tuple[dict, str]: (series payload, message)
    """
    body = body or {}
    scenario_id, mode, value_type = _base_validate(body)

    top_date = body.get("date") or None
    start_str = (body.get("start_time") or "").strip()
    end_str   = (body.get("end_time") or "").strip()

    try:
        if top_date: datetime.strptime(top_date, "%Y%m%d")
    except ValueError:
        raise ServiceError(Messages.BA_DATE_FORMAT_YYYYMMDD_JA, "invalid date", http_status.HTTP_400_BAD_REQUEST)
    try:
        start_t, end_t = _parse_time_range(start_str, end_str)
    except Exception as e:
        raise ServiceError(str(e), "invalid time range", http_status.HTTP_400_BAD_REQUEST)

    rows = body.get("data") or []
    filter_route_groups = set(body.get("route_groups") or [])
    filter_routes       = set(body.get("routes") or [])
    filter_trips        = set(body.get("trips") or [])

    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)
    grouping_method = (getattr(scenario, "stops_grouping_method", "") or "").lower()

    gA, gB = _selection_validate(scenario, mode, body, grouping_method)

    routes_from_groups: Set[str] = set()
    if filter_route_groups and RouteKeywordMap:
        try:
            rids = RouteKeywordMap.objects.filter(
                scenario=scenario, keyword__keyword__in=list(filter_route_groups)
            ).values_list("route_id", flat=True).distinct()
            routes_from_groups = set(rids)
        except Exception:
            routes_from_groups = set()

    if filter_trips:
        routes_filter_for_materialization: Optional[Set[str]] = None
        effective_routes: Optional[Set[str]] = None
    elif filter_routes:
        effective_routes = set(filter_routes)
        routes_filter_for_materialization = effective_routes
    elif routes_from_groups:
        effective_routes = routes_from_groups
        routes_filter_for_materialization = effective_routes
    else:
        effective_routes = None
        routes_filter_for_materialization = None

    trip_map, target_trips, st_qs, stop_ids, stop_coord = _load_materialized(
        scenario, routes_filter_for_materialization, rows
    )

    if filter_trips:
        target_trips &= filter_trips
        if not target_trips:
            series = [{"time": f"{h:02d}:00:00", "value": 0} for h in range(24)]
            if mode == "segment":
                seg = body.get("segment") or {}
                data = {"segment": {"from_keyword": seg.get("from_keyword"), "to_keyword": seg.get("to_keyword")},
                        "series": series, "stats": {"average": 0, "maximum": 0, "total": 0}}
            else:
                data = {"stop": {"keyword": (body.get("stop") or {}).get("keyword")},
                        "series": series, "stats": {"average": 0, "maximum": 0, "total": 0}}
            return data, Messages.BA_NO_TRIPS_FOUND_JA
        st_qs = [r for r in st_qs if r["trip_id"] in target_trips]

    if mode == "segment":
        occurs, _, _ = _collect_occurrences(mode, gA, gB, grouping_method, st_qs, trip_map, scenario)
    else:
        occurs, _, _ = _collect_occurrences(mode, gA, None, grouping_method, st_qs, trip_map, scenario)

    events_by_trip_stop = _events_index(rows, {r["trip_id"] for r in st_qs}, stop_ids, top_date)

    trip_seq_rows: Dict[str, List[dict]] = defaultdict(list)
    for row in st_qs:
        trip_seq_rows[row["trip_id"]].append(row)

    hour_values: Dict[str, int] = defaultdict(int)

    if mode == "segment":
        for rid, tid, sidA, sidB, depA, arrB in occurs:
            if value_type in ("in_car", "boarding"):
                if not _time_in_range(depA, start_t, end_t):
                    continue
            else:
                if not _time_in_range(arrB, start_t, end_t):
                    continue

            if value_type == "in_car":
                load = 0
                for r in trip_seq_rows[tid]:
                    ev = events_by_trip_stop.get((tid, r["stop_id"]), {"on": 0, "off": 0})
                    load += ev["on"] - ev["off"]
                    if r["stop_id"] == sidA:
                        if load < 0: load = 0
                        tkey = _hour_bucket(depA)
                        if tkey: hour_values[tkey] += int(load)
                        break
            elif value_type == "boarding":
                evA = events_by_trip_stop.get((tid, sidA), {"on": 0, "off": 0})
                tkey = _hour_bucket(depA)
                if tkey: hour_values[tkey] += int(evA["on"])
            else:
                evB = events_by_trip_stop.get((tid, sidB), {"on": 0, "off": 0})
                tkey = _hour_bucket(arrB)
                if tkey: hour_values[tkey] += int(evB["off"])

        seg = body.get("segment") or {}
        series = [{"time": f"{h:02d}:00:00", "value": int(hour_values.get(f"{h:02d}:00:00", 0))} for h in range(24)]
        data = {
            "segment": {"from_keyword": seg.get("from_keyword"), "to_keyword": seg.get("to_keyword")},
            "series": series,
            "stats": _stats_from_series_map(hour_values)
        }
    else:
        for rid, tid, sidX, depX, arrX in occurs:
            if value_type == "in_car":
                load = 0
                for r in trip_seq_rows[tid]:
                    ev = events_by_trip_stop.get((tid, r["stop_id"]), {"on": 0, "off": 0})
                    load += ev["on"] - ev["off"]
                    if r["stop_id"] == sidX:
                        if load < 0:
                            load = 0
                        if _time_in_range(depX, start_t, end_t):
                            tkey = _hour_bucket(depX)
                            if tkey:
                                hour_values[tkey] += int(load)
                        break
            elif value_type == "boarding":
                ev = events_by_trip_stop.get((tid, sidX), {"on": 0, "off": 0})
                if _time_in_range(depX, start_t, end_t):
                    tkey = _hour_bucket(depX)
                    if tkey:
                        hour_values[tkey] += int(ev["on"])
            else:
                ev = events_by_trip_stop.get((tid, sidX), {"on": 0, "off": 0})
                if _time_in_range(arrX, start_t, end_t):
                    tkey = _hour_bucket(arrX)
                    if tkey:
                        hour_values[tkey] += int(ev["off"])

        series = [{"time": f"{h:02d}:00:00", "value": int(hour_values.get(f"{h:02d}:00:00", 0))} for h in range(24)]
        data = {
            "stop": {"keyword": (body.get("stop") or {}).get("keyword")},
            "series": series,
            "stats": _stats_from_series_map(hour_values)
        }
    return data, Messages.BA_AGGREGATION_COMPLETED_JA


def _base_validate(body):
    """Validate common required fields for segment/stop analytics."""
    scenario_id = body.get("scenario_id")
    mode = (body.get("mode") or "").strip().lower()
    value_type = (body.get("type") or "in_car").strip().lower()
    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    if mode not in ("segment", "stop"):
        raise ServiceError(Messages.BA_MODE_INVALID_SPECIFY_JA, "invalid mode", http_status.HTTP_400_BAD_REQUEST)
    if value_type not in ("in_car", "boarding", "alighting"):
        raise ServiceError(Messages.BA_TYPE_INVALID_SPECIFY_JA, "invalid type", http_status.HTTP_400_BAD_REQUEST)
    return scenario_id, mode, value_type

def _selection_validate(scenario, mode, body, grouping_method):
    """Validate segment/stop selection payload and resolve group keys."""
    if mode == "segment":
        seg = body.get("segment") or {}
        if not isinstance(seg, dict) or not seg.get("from_keyword") or not seg.get("to_keyword"):
            raise ServiceError(Messages.BA_SEGMENT_FORMAT_REQUIRED_JA, "segment missing", http_status.HTTP_400_BAD_REQUEST)
        from_keys = _resolve_group_keys_for_keyword(scenario, grouping_method, seg["from_keyword"])
        to_keys   = _resolve_group_keys_for_keyword(scenario, grouping_method, seg["to_keyword"])
        if not from_keys:
            raise ServiceError(
                Messages.BA_FROM_KEYWORD_GROUP_NOT_FOUND_TEMPLATE_JA.format(from_keyword=seg["from_keyword"]),
                "from not found",
                http_status.HTTP_404_NOT_FOUND,
            )
        if not to_keys:
            raise ServiceError(
                Messages.BA_TO_KEYWORD_GROUP_NOT_FOUND_TEMPLATE_JA.format(to_keyword=seg["to_keyword"]),
                "to not found",
                http_status.HTTP_404_NOT_FOUND,
            )
        if len(from_keys) > 1 or len(to_keys) > 1:
            raise ServiceError(Messages.BA_AMBIGUOUS_KEYWORDS_JA, "ambiguous keywords", http_status.HTTP_400_BAD_REQUEST)
        return next(iter(from_keys)), next(iter(to_keys))

    stop_spec = body.get("stop") or {}
    if not isinstance(stop_spec, dict) or not stop_spec.get("keyword"):
        raise ServiceError(Messages.BA_STOP_FORMAT_REQUIRED_JA, "stop missing", http_status.HTTP_400_BAD_REQUEST)
    gkeys = _resolve_group_keys_for_keyword(scenario, grouping_method, stop_spec["keyword"])
    if not gkeys:
        raise ServiceError(
            Messages.BA_KEYWORD_STOP_GROUP_NOT_FOUND_TEMPLATE_JA.format(keyword=stop_spec["keyword"]),
            "keyword not found",
            http_status.HTTP_404_NOT_FOUND,
        )
    if len(gkeys) > 1:
        raise ServiceError(Messages.BA_AMBIGUOUS_KEYWORDS_JA, "ambiguous keyword", http_status.HTTP_400_BAD_REQUEST)
    return next(iter(gkeys)), None

def _load_materialized(scenario, routes_filter: Set[str] | None, rows: List[dict] | None):
    """Load Trips/StopTimes/Stops data for the scenario and filters."""
    trips_qs = Trips.objects.filter(scenario=scenario)
    if routes_filter:
        trips_qs = trips_qs.filter(route_id__in=list(routes_filter))
    trip_rows = list(trips_qs.values("trip_id", "route_id"))
    trip_map = {t["trip_id"]: t for t in trip_rows}

    trips_from_data = {r.get("trip_id") for r in (rows or []) if r.get("trip_id")}
    target_trips = (set(trip_map.keys()) & trips_from_data) if trips_from_data else set(trip_map.keys())

    st_qs = list(
        StopTimes.objects
        .filter(scenario=scenario, trip_id__in=list(target_trips))
        .values("trip_id", "stop_id", "stop_sequence", "departure_time", "arrival_time")
        .order_by("trip_id", "stop_sequence")
    )
    stop_ids = {row["stop_id"] for row in st_qs}
    stop_coord: Dict[str, Tuple[float, float, str]] = {}
    for s in Stops.objects.filter(scenario=scenario, stop_id__in=stop_ids)\
                          .values("stop_id", "stop_lon", "stop_lat", "stop_name"):
        stop_coord[s["stop_id"]] = (float(s["stop_lon"]), float(s["stop_lat"]), s["stop_name"])

    return trip_map, set(target_trips), st_qs, stop_ids, stop_coord

def _collect_occurrences(
    mode: str,
    gA: str,
    gB: Optional[str],
    grouping_method: str,
    st_qs: List[dict],
    trip_map: Dict[str, dict],
    scenario: Scenario,
    ):
    """
    Collect segment/stop occurrences with route and trip context.

    mode=segment: [(rid, tid, sidA, sidB, depA, arrB)]
    mode=stop   : [(rid, tid, sidX, depX, arrX)]
    """
    stop_ids = {row["stop_id"] for row in st_qs}
    group_key_by_stop: Dict[str, str] = {}
    if grouping_method == "stop_name":
        maps = StopNameKeywordMap.objects.filter(stop_id__in=stop_ids, scenario=scenario)\
                                         .values("stop_id", "stop_name_group_id")
        for m in maps:
            group_key_by_stop[m["stop_id"]] = f"name:{m['stop_name_group_id']}"
    elif grouping_method == "stop_id":
        maps = StopIdKeywordMap.objects.filter(stop_id__in=stop_ids, scenario=scenario)\
                                       .values("stop_id", "stop_id_group_id")
        for m in maps:
            group_key_by_stop[m["stop_id"]] = f"id:{m['stop_id_group_id']}"
    for sid in stop_ids:
        group_key_by_stop.setdefault(sid, f"stop:{sid}")

    trip_seq_rows: Dict[str, List[dict]] = defaultdict(list)
    for row in st_qs:
        trip_seq_rows[row["trip_id"]].append(row)

    if mode == "segment":
        occurs = []
        routes_seen: Set[str] = set()
        trips_seen: Set[str] = set()
        for tid, seq in trip_seq_rows.items():
            prev = None
            for row in seq:
                if prev is not None:
                    GA = group_key_by_stop.get(prev["stop_id"])
                    GB = group_key_by_stop.get(row["stop_id"])
                    if GA == gA and GB == gB:
                        rid = trip_map[tid]["route_id"]
                        occurs.append((rid, tid, prev["stop_id"], row["stop_id"],
                                       _to_time(prev["departure_time"]),
                                       _to_time(row["arrival_time"])))
                        routes_seen.add(rid); trips_seen.add(tid)
                prev = row
        return occurs, routes_seen, trips_seen

    occurs = []
    routes_seen: Set[str] = set()
    trips_seen: Set[str] = set()
    for tid, seq in trip_seq_rows.items():
        for row in seq:
            sid = row["stop_id"]
            if group_key_by_stop.get(sid) == gA:
                rid = trip_map[tid]["route_id"]
                occurs.append((rid, tid, sid, _to_time(row["departure_time"]), _to_time(row["arrival_time"])))
                routes_seen.add(rid); trips_seen.add(tid)
    return occurs, routes_seen, trips_seen

def _events_index(rows: List[dict], target_trips: Set[str], stop_ids: Set[str], top_date: Optional[str]):
    """Index event rows by trip and stop."""
    filtered_rows: List[dict] = []
    for r in rows or []:
        if not isinstance(r, dict):
            continue
        if top_date and r.get("date") and r["date"] != top_date:
            continue
        filtered_rows.append(r)

    events_by_trip_stop: Dict[Tuple[str, str], Dict[str, int]] = defaultdict(lambda: {"on": 0, "off": 0})
    for r in filtered_rows:
        tid, sid = r.get("trip_id"), r.get("stop_id")
        if tid in target_trips and sid in stop_ids:
            events_by_trip_stop[(tid, sid)]["on"]  += int(r.get("count_geton")  or 0)
            events_by_trip_stop[(tid, sid)]["off"] += int(r.get("count_getoff") or 0)
    return events_by_trip_stop

def build_segment_stop_analytics_filter(body):
    """
    Build available filters (route groups/routes/trips) for a segment or stop.

    Parameters:
    - body (dict): Request payload.
    - scenario_id (str): Scenario identifier.
    - mode (str): segment | stop.
    - type (str): in_car | boarding | alighting.
    - segment (dict|None): Segment selector for segment mode.
    - stop (dict|None): Stop selector for stop mode.
    - date (str|None): Service date (YYYYMMDD).
    - start_time (str|None): Start time (HH:MM:SS).
    - end_time (str|None): End time (HH:MM:SS).
    - data (list[dict]): Event rows.

    Returns:
    - tuple[dict, str]: (filter payload, message)
    """
    body = body or {}
    scenario_id, mode, value_type = _base_validate(body)

    top_date = body.get("date") or None
    start_str = (body.get("start_time") or "").strip()
    end_str   = (body.get("end_time") or "").strip()

    try:
        if top_date: datetime.strptime(top_date, "%Y%m%d")
    except ValueError:
        raise ServiceError(Messages.BA_DATE_FORMAT_YYYYMMDD_JA, "invalid date", http_status.HTTP_400_BAD_REQUEST)
    try:
        start_t, end_t = _parse_time_range(start_str, end_str)
    except Exception as e:
        raise ServiceError(str(e), "invalid time range", http_status.HTTP_400_BAD_REQUEST)

    rows = body.get("data") or []

    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)
    grouping_method = (getattr(scenario, "stops_grouping_method", "") or "").lower()

    gA, gB = _selection_validate(scenario, mode, body, grouping_method)

    trip_map, target_trips, st_qs, stop_ids, stop_coord = _load_materialized(scenario, None, rows)
    occurs, routes_seen, trips_seen = _collect_occurrences(
        mode, gA, gB, grouping_method, st_qs, trip_map, scenario
    )

    if start_t and end_t:
        if mode == "segment":
            occurs = [o for o in occurs if (
                (value_type in ("in_car", "boarding") and _time_in_range(o[4], start_t, end_t)) or
                (value_type == "alighting" and _time_in_range(o[5], start_t, end_t))
            )]
        else:
            occurs = [o for o in occurs if (
                (value_type in ("in_car", "boarding") and _time_in_range(o[3], start_t, end_t)) or
                (value_type == "alighting" and _time_in_range(o[4], start_t, end_t))
            )]
        if mode == "segment":
            routes_seen = set(o[0] for o in occurs); trips_seen = set(o[1] for o in occurs)
        else:
            routes_seen = set(o[0] for o in occurs); trips_seen = set(o[1] for o in occurs)

    route_to_trips = defaultdict(set)
    if mode == "segment":
        for rid, tid, *_ in occurs:
            route_to_trips[rid].add(tid)
    else:
        for rid, tid, *_ in occurs:
            route_to_trips[rid].add(tid)

    hierarchy = []
    flat_route_groups = []
    flat_routes = sorted(routes_seen)
    flat_trips  = sorted(trips_seen)

    if RouteKeywordMap and routes_seen:
        qs = RouteKeywordMap.objects.filter(
            scenario=scenario, route_id__in=list(routes_seen)
        ).values("route_id", "keyword__keyword")
        group_to_routes = defaultdict(set)
        for r in qs:
            group_to_routes[r["keyword__keyword"]].add(r["route_id"])

        mapped_routes = set().union(*group_to_routes.values()) if group_to_routes else set()
        ungrouped = set(routes_seen) - mapped_routes
        if ungrouped:
            group_to_routes["(ungrouped)"].update(ungrouped)

        for gname in sorted(group_to_routes.keys(), key=lambda s: (s == "(ungrouped)", s)):
            flat_route_groups.append(gname)
            routes_payload = []
            for rid in sorted(group_to_routes[gname]):
                routes_payload.append({"route_id": rid, "trips": sorted(route_to_trips.get(rid, []))})
            hierarchy.append({"route_group": gname, "routes": routes_payload})
    else:
        flat_route_groups = []
        routes_payload = []
        for rid in flat_routes:
            routes_payload.append({"route_id": rid, "trips": sorted(route_to_trips.get(rid, []))})
        hierarchy.append({"route_group": [], "routes": routes_payload})

    selection_obj = {"mode": mode}
    if mode == "segment":
        seg = body.get("segment")
        selection_obj["segment"] = {"from_keyword": seg["from_keyword"], "to_keyword": seg["to_keyword"]}
    else:
        selection_obj["stop"] = {"keyword": (body.get("stop") or {}).get("keyword")}

    data = {
        "selection": selection_obj,
        "filters": {
            "hierarchy": hierarchy,
            "flat": {
                "route_groups": flat_route_groups,
                "routes": flat_routes,
                "trips": flat_trips
            }
        }
    }
    return data, Messages.BA_FILTERS_RETURNED_JA
