# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict
from datetime import datetime, timedelta, time as dtime
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Dict, List, Tuple, Set
from math import cos, radians, sqrt

from django.db.models import Min, Max
from rest_framework import status as http_status

from gtfs.models import (
    Scenario, Routes, Trips, StopTimes, Stops, Shape,
    StopNameKeywords, StopNameKeywordMap,
    StopIdKeyword, StopIdKeywordMap,
    RouteKeywords, RouteKeywordMap
)
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages

@dataclass
class GroupMetaSegment:
    name: str
    lon: float
    lat: float

def _to_time(val):
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

def _deg_per_meter(lat_deg: float) -> Tuple[float, float]:
    """Compute degrees per meter at a latitude."""
    deg_lat_per_m = 1.0 / 110540.0
    deg_lon_per_m = 1.0 / (111320.0 * max(0.000001, cos(radians(lat_deg))))
    return deg_lon_per_m, deg_lat_per_m


def _offset_line(lon1: float, lat1: float, lon2: float, lat2: float,
                 offset_m: float, left_of_AtoB: bool = True) -> Tuple[list, list]:
    """
    Create offset line endpoints for a segment.

    Return two offset points (p1, p2) for a line A(lon1,lat1) -> B(lon2,lat2),
    offset by 'offset_m' meters to the left/right of the direction A->B.
    """
    if offset_m <= 0:
        return [lon1, lat1], [lon2, lat2]

    # Approx. meters per degree (local)
    lat_mid = (lat1 + lat2) / 2.0
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * cos(radians(lat_mid))

    # Convert to "meter space"
    x1, y1 = lon1 * m_per_deg_lon, lat1 * m_per_deg_lat
    x2, y2 = lon2 * m_per_deg_lon, lat2 * m_per_deg_lat

    dx, dy = x2 - x1, y2 - y1
    L = sqrt(dx*dx + dy*dy)
    if L == 0:
        return [lon1, lat1], [lon2, lat2]

    # Unit perp to the left of A->B is (-dy/L, dx/L)
    sign = 1.0 if left_of_AtoB else -1.0
    ox = sign * (-dy / L) * offset_m
    oy = sign * ( dx / L) * offset_m

    # Apply offset (still in meters), then convert back to degrees
    p1x, p1y = x1 + ox, y1 + oy
    p2x, p2y = x2 + ox, y2 + oy
    p1 = [p1x / m_per_deg_lon, p1y / m_per_deg_lat]
    p2 = [p2x / m_per_deg_lon, p2y / m_per_deg_lat]
    return p1, p2


def build_group_index(
    scenario: Scenario,
    grouping_method: str,
    stop_ids: set[str],
    stop_coord: Dict[str, Tuple[float, float, str]], 
) -> Tuple[Dict[str, str], Dict[str, GroupMetaSegment]]:
    """Build stop grouping index and metadata."""
   
    group_key_by_stop: Dict[str, str] = {}
    group_meta: Dict[str, GroupMetaSegment] = {}

    def _centroid(sids: List[str]) -> Tuple[float, float]:
        xs = ys = n = 0
        for sid in sids:
            if sid in stop_coord:
                x, y, _ = stop_coord[sid]
                xs += x; ys += y; n += 1
        if n > 0:
            return xs / n, ys / n
        return 0.0, 0.0

    def _first_stop_name(sids: List[str]) -> str:
        for sid in sids:
            nm = stop_coord.get(sid, (0.0, 0.0, ""))[2]
            if nm:
                return nm
        return "" 

    if grouping_method == "stop_name":
        maps = list(
            StopNameKeywordMap.objects
            .filter(scenario=scenario, stop_id__in=stop_ids)
            .values("stop_id", "stop_name_group_id")
        )
        members_by_label: Dict[str, List[str]] = defaultdict(list)
        for m in maps:
            sid = m["stop_id"]
            label = m["stop_name_group_id"]  
            if sid in stop_ids:
                members_by_label[label].append(sid)
                group_key_by_stop[sid] = f"name:{label}"

        labels: Set[str] = set(members_by_label.keys())

        kw_qs = list(
            StopNameKeywords.objects
            .filter(scenario=scenario, stop_group_id_label__in=labels)
            .values("stop_group_id_label", "stop_name_keyword", "stop_names_long", "stop_names_lat")
        )
        kw_by_label = {r["stop_group_id_label"]: r for r in kw_qs}

        for label, sids in members_by_label.items():
            kw = kw_by_label.get(label)
            name = (kw["stop_name_keyword"] if kw else _first_stop_name(sids)) or label  
            if kw:
                lon = float(kw["stop_names_long"] or 0.0)
                lat = float(kw["stop_names_lat"] or 0.0)
            else:
                lon = lat = 0.0
            if not lon or not lat:
                lon, lat = _centroid(sids)
            group_meta[f"name:{label}"] = GroupMetaSegment(name=name, lon=lon, lat=lat)

        for sid in stop_ids:
            if sid not in group_key_by_stop:
                x, y, nm = stop_coord.get(sid, (0.0, 0.0, ""))  
                gk = f"stop:{sid}"
                group_key_by_stop[sid] = gk
                group_meta[gk] = group_meta.get(gk) or GroupMetaSegment(
                    name=(nm or ""), lon=float(x), lat=float(y)
                )

    elif grouping_method == "stop_id":
        maps = list(
            StopIdKeywordMap.objects
            .filter(scenario=scenario, stop_id__in=stop_ids)
            .values("stop_id", "stop_id_group_id")
        )
        members_by_gid: Dict[int, List[str]] = defaultdict(list)
        for m in maps:
            sid = m["stop_id"]
            gid = int(m["stop_id_group_id"])
            if sid in stop_ids:
                members_by_gid[gid].append(sid)
                group_key_by_stop[sid] = f"id:{gid}"

        gids: Set[int] = set(members_by_gid.keys())

        kw_qs = list(
            StopIdKeyword.objects
            .filter(scenario=scenario, stop_group_id__in=gids)
            .values("stop_group_id", "stop_id_keyword", "stop_id_long", "stop_id_lat")
        )
        kw_by_gid = {int(r["stop_group_id"]): r for r in kw_qs}

        for gid, sids in members_by_gid.items():
            kw = kw_by_gid.get(gid)
            name = (kw["stop_id_keyword"] if kw else _first_stop_name(sids)) or f"group:{gid}"
            if kw:
                lon = float(kw["stop_id_long"] or 0.0)
                lat = float(kw["stop_id_lat"] or 0.0)
            else:
                lon = lat = 0.0
            if not lon or not lat:
                lon, lat = _centroid(sids)
            group_meta[f"id:{gid}"] = GroupMetaSegment(name=name, lon=lon, lat=lat)

        for sid in stop_ids:
            if sid not in group_key_by_stop:
                x, y, nm = stop_coord.get(sid, (0.0, 0.0, ""))  
                gk = f"stop:{sid}"
                group_key_by_stop[sid] = gk
                group_meta[gk] = group_meta.get(gk) or GroupMetaSegment(
                    name=(nm or ""), lon=float(x), lat=float(y)
                )

    else:
        for sid in stop_ids:
            x, y, nm = stop_coord.get(sid, (0.0, 0.0, ""))  
            gk = f"stop:{sid}"
            group_key_by_stop[sid] = gk
            group_meta[gk] = GroupMetaSegment(name=(nm or ""), lon=float(x), lat=float(y))

    return group_key_by_stop, group_meta


def build_stop_keyword_points(
    scenario: Scenario,
    grouping_method: str,
    legend_by_group: Dict[str, Dict[str, int]] | None = None,  
) -> List[dict]:
    """Build stop keyword points for catalog GeoJSON."""
    feats: List[dict] = []

    def _legend_for(gk: str) -> dict | None:
        if legend_by_group is None:
            return None
        t = legend_by_group.get(gk)
        if not t:
            return {"boarding_total": 0, "alighting_total": 0, "boarding_alighting_total": 0}
        return {
            "boarding_total": int(t.get("boarding", 0)),
            "alighting_total": int(t.get("alighting", 0)),
            "boarding_alighting_total": int(t.get("boarding", 0)) + int(t.get("alighting", 0)),
        }

    if grouping_method == "stop_name":
        kws = list(
            StopNameKeywords.objects.filter(scenario=scenario)
            .values("stop_group_id_label", "stop_name_keyword", "stop_names_long", "stop_names_lat", "stop_group_id")
        )
        m_qs = list(
            StopNameKeywordMap.objects.filter(scenario=scenario)
            .values("stop_id", "stop_name_group_id")
        )
        stops_all = {
            s["stop_id"]: (float(s["stop_lon"]), float(s["stop_lat"]))
            for s in Stops.objects.filter(scenario=scenario).values("stop_id", "stop_lon", "stop_lat")
        }
        coords_by_label: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
        count_by_label: Dict[str, int] = defaultdict(int)
        for m in m_qs:
            sid = m["stop_id"]
            label = m["stop_name_group_id"]
            if sid in stops_all:
                coords_by_label[label].append(stops_all[sid])
                count_by_label[label] += 1

        for r in kws:
            label = r["stop_group_id_label"]
            name  = r["stop_name_keyword"]
            unique_id = r["stop_group_id"]
            lon   = float(r["stop_names_long"] or 0.0)
            lat   = float(r["stop_names_lat"] or 0.0)
            if not lon or not lat:
                lon, lat = _centroid(coords_by_label.get(label, []))  
            gk = f"name:{unique_id}"  
            props = {
                "stop_keyword": name,
                "group_label": label,
                "group_size": int(count_by_label.get(label, 0)),
                "feature_class": "stop_keyword",
            }
            lg = _legend_for(gk)
            if lg is not None:
                props["legend"] = lg
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props
            })
        return feats

    if grouping_method == "stop_id":
        kws = list(
            StopIdKeyword.objects.filter(scenario=scenario)
            .values("stop_group_id", "stop_id_keyword", "stop_id_long", "stop_id_lat")
        )
        m_qs = list(
            StopIdKeywordMap.objects.filter(scenario=scenario)
            .values("stop_id", "stop_id_group_id")
        )
        stops_all = {
            s["stop_id"]: (float(s["stop_lon"]), float(s["stop_lat"]))
            for s in Stops.objects.filter(scenario=scenario).values("stop_id", "stop_lon", "stop_lat")
        }
        coords_by_gid: Dict[int, List[Tuple[float, float]]] = defaultdict(list)
        count_by_gid: Dict[int, int] = defaultdict(int)
        for m in m_qs:
            sid = m["stop_id"]; gid = int(m["stop_id_group_id"])
            if sid in stops_all:
                coords_by_gid[gid].append(stops_all[sid])
                count_by_gid[gid] += 1

        for r in kws:
            gid  = int(r["stop_group_id"])
            name = r["stop_id_keyword"]
            lon  = float(r["stop_id_long"] or 0.0)
            lat  = float(r["stop_id_lat"] or 0.0)
            if not lon or not lat:
                lon, lat = _centroid(coords_by_gid.get(gid, []))
            gk = f"id:{gid}"  
            props = {
                "stop_keyword": name,
                "group_id": gid,
                "group_size": int(count_by_gid.get(gid, 0)),
                "feature_class": "stop_keyword",
            }
            lg = _legend_for(gk)
            if lg is not None:
                props["legend"] = lg
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props
            })
        return feats

    for s in Stops.objects.filter(scenario=scenario).values("stop_id", "stop_lon", "stop_lat", "stop_name"):
        gk = f"stop:{s['stop_id']}"  
        props = {
            "stop_keyword": s["stop_name"] or s["stop_id"],
            "stop_id": s["stop_id"],
            "feature_class": "stop_keyword",
        }
        lg = _legend_for(gk)
        if lg is not None:
            props["legend"] = lg
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(s["stop_lon"]), float(s["stop_lat"])]},
            "properties": props
        })
    return feats

def build_segment_catalog(body):
    """
    Build segment and stop catalog GeoJSON for boarding/alighting.

    Parameters:
    - body (dict): Request payload.
    - scenario_id (str): Scenario identifier.
    - routes (list[str]|None): Filter routes.
    - with_analytics (bool): Include boarding/alighting totals in legend.
    - data (list[dict]): Event rows for analytics.
    - date (str|None): Service date (YYYYMMDD).
    - time (str|None): Anchor time (HH:MM:SS).
    - offset_m (float|None): Segment offset in meters.

    Returns:
    - tuple[dict, str]: (GeoJSON FeatureCollection payload, message)
    """
    body = body or {}
    scenario_id    = body.get("scenario_id")
    routes         = set(body.get("routes") or [])
    with_analytics = bool(body.get("with_analytics", False))
    legend_by_group: Dict[str, Dict[str, int]] | None = None
    rows           = body.get("data") or []
    date_str       = body.get("date") or None
    time_str       = (body.get("time") or "").strip()
    try:
        offset_m  = float(body.get("offset_m", 15.0))
    except Exception:
        offset_m  = 15.0
    if offset_m < 0:
        offset_m = 0.0

    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)

    if date_str:
        try:
            datetime.strptime(date_str, "%Y%m%d")
        except ValueError:
            raise ServiceError(Messages.BA_DATE_FORMAT_YYYYMMDD_JA, "invalid date", http_status.HTTP_400_BAD_REQUEST)

    start_t = end_t = None
    if time_str:
        try:
            hh, mm, ss = map(int, time_str.split(":"))
            start_t = dtime(hh, mm, ss)
            end_dt = datetime(2000, 1, 1, hh, mm, ss) + timedelta(hours=1)
            end_t = dtime(end_dt.hour, end_dt.minute, end_dt.second)
        except Exception:
            raise ServiceError(Messages.BA_TIME_FORMAT_HHMMSS_JA, "invalid time", http_status.HTTP_400_BAD_REQUEST)

    if with_analytics and not rows:
        raise ServiceError(Messages.BA_WITH_ANALYTICS_DATA_REQUIRED_JA, "data missing", http_status.HTTP_400_BAD_REQUEST)

    # ===== Scope trips (routes filter) =====
    trips_qs = Trips.objects.filter(scenario=scenario)
    if routes:
        trips_qs = trips_qs.filter(route_id__in=list(routes))

    trip_rows = list(trips_qs.values("trip_id", "route_id"))
    if not trip_rows:
        return {"type": "FeatureCollection", "features": []}, Messages.BA_NO_DATA_MATCH_JA

    trip_map = {t["trip_id"]: t for t in trip_rows}
    trip_ids = set(trip_map.keys())

    # ===== StopTimes & Stops =====
    st_qs = list(
        StopTimes.objects
        .filter(scenario=scenario, trip_id__in=list(trip_ids))
        .values("trip_id", "stop_id", "stop_sequence", "departure_time", "arrival_time")
        .order_by("trip_id", "stop_sequence")
    )
    stop_ids = {row["stop_id"] for row in st_qs}

    stop_coord: Dict[str, Tuple[float, float, str]] = {}
    for s in Stops.objects.filter(scenario=scenario, stop_id__in=stop_ids)\
                          .values("stop_id", "stop_lon", "stop_lat", "stop_name"):
        stop_coord[s["stop_id"]] = (float(s["stop_lon"]), float(s["stop_lat"]), s["stop_name"])

    # ===== Grouping method =====
    gm_raw = (
        getattr(scenario, "stops_grouping_method", None)
        or getattr(scenario, "grouping_method", "")
        or ""
    )
    grouping_method = str(gm_raw).lower()
    group_key_by_stop, group_meta = build_group_index(scenario, grouping_method, stop_ids, stop_coord)

    occ_by_seg: Dict[Tuple[str, str], List[Tuple[str, str, str, str, dtime | None, dtime | None]]] = defaultdict(list)

    trip_seq_rows: Dict[str, List[dict]] = defaultdict(list)
    for row in st_qs:
        trip_seq_rows[row["trip_id"]].append(row)

    for tid, seq in trip_seq_rows.items():
        prev = None
        for row in seq:
            if prev is not None:
                gA = group_key_by_stop.get(prev["stop_id"])
                gB = group_key_by_stop.get(row["stop_id"])
                if gA and gB and gA != gB:
                    rid = trip_map[tid]["route_id"]
                    occ_by_seg[(gA, gB)].append((
                        rid, tid, prev["stop_id"], row["stop_id"],
                        _to_time(prev["departure_time"]), _to_time(row["arrival_time"])
                    ))
            prev = row

    name_to_gpair: Dict[str, Tuple[str, str]] = {}
    features: List[dict] = []
    for (gA, gB), occs in occ_by_seg.items():
        mA = group_meta.get(gA); mB = group_meta.get(gB)
        if not (mA and mB):
            continue
        p1, p2 = _offset_line(mA.lon, mA.lat, mB.lon, mB.lat, offset_m, left_of_AtoB=True)
        mid = [(p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0]
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [p1, p2]},
            "properties": {
                "segment_key": f"{mA.name} - {mB.name}",
                "from_keyword": mA.name,
                "to_keyword": mB.name,
                "label_point": mid,
                "offset_m": float(offset_m),
            }
        })

  
    if with_analytics:
        filtered_rows = []
        for r in rows:
            if not isinstance(r, dict):
                continue
            if date_str and r.get("date") and r["date"] != date_str:
                continue
            filtered_rows.append(r)

        events_by_trip_stop: Dict[Tuple[str, str], Dict[str, int]] = defaultdict(lambda: {"on": 0, "off": 0})
        for r in filtered_rows:
            tid, sid = r.get("trip_id"), r.get("stop_id")
            if (tid in trip_ids) and (sid in stop_ids):
                events_by_trip_stop[(tid, sid)]["on"]  += int(r.get("count_geton")  or 0)
                events_by_trip_stop[(tid, sid)]["off"] += int(r.get("count_getoff") or 0)

        times_by_trip_stop: Dict[Tuple[str, str], Tuple[dtime|None, dtime|None]] = {}
        for tid, seq in trip_seq_rows.items():
            for row in seq:
                dep = _to_time(row["departure_time"])
                arr = _to_time(row["arrival_time"])
                times_by_trip_stop[(tid, row["stop_id"])] = (dep, arr)

        load_at_stop: Dict[Tuple[str, str], int] = {}
        for tid, seq in trip_seq_rows.items():
            load = 0
            for row in seq:
                ev = events_by_trip_stop.get((tid, row["stop_id"]), {"on": 0, "off": 0})
                load += ev["on"] - ev["off"]
                if load < 0:
                    load = 0
                load_at_stop[(tid, row["stop_id"])] = load

        effective_route_filter = set(routes) if routes else None

        def time_ok(t: dtime | None) -> bool:
            if not (start_t and end_t):
                return True
            if not t:
                return False
            if start_t <= end_t:
                return start_t <= t <= end_t
            return (t >= start_t) or (t <= end_t)

        totals: Dict[Tuple[str, str], Dict[str, int]] = defaultdict(lambda: {"boarding": 0, "alighting": 0, "in_car": 0})
        for (gA, gB), occs in occ_by_seg.items():
            for rid, tid, sidA, sidB, depA, arrB in occs:
                if effective_route_filter and rid not in effective_route_filter:
                    continue
                if time_ok(depA):
                    evA = events_by_trip_stop.get((tid, sidA), {"on": 0, "off": 0})
                    totals[(gA, gB)]["boarding"] += int(evA["on"])
                    totals[(gA, gB)]["in_car"]   += int(load_at_stop.get((tid, sidA), 0))
                if time_ok(arrB):
                    evB = events_by_trip_stop.get((tid, sidB), {"on": 0, "off": 0})
                    totals[(gA, gB)]["alighting"] += int(evB["off"])

        legend_by_group = defaultdict(lambda: {"boarding": 0, "alighting": 0})
        for (tid, sid), ev in events_by_trip_stop.items():
            trip_info = trip_map.get(tid)
            if not trip_info:
                continue

            rid = trip_info["route_id"]
            if effective_route_filter and rid not in effective_route_filter:
                continue

            if (tid, sid) not in times_by_trip_stop:
                continue

            dep, arr = times_by_trip_stop[(tid, sid)]
            gk = group_key_by_stop.get(sid)
            if not gk:
                continue

            if time_ok(dep):
                legend_by_group[gk]["boarding"] += int(ev.get("on", 0))

            if time_ok(arr):
                legend_by_group[gk]["alighting"] += int(ev.get("off", 0))

        for (gA, gB) in occ_by_seg.keys():
            mA, mB = group_meta.get(gA), group_meta.get(gB)
            if mA and mB:
                name_to_gpair[f"{mA.name} - {mB.name}"] = (gA, gB)

        for f in features:
            if f.get("geometry", {}).get("type") != "LineString":
                continue
            props = f.get("properties", {})
            gpair = name_to_gpair.get(props.get("segment_key", ""))
            t = totals.get(gpair or ("",""), {"boarding": 0, "alighting": 0, "in_car": 0})
            props["legend"] = {
                "boarding_total": int(t.get("boarding", 0)),
                "alighting_total": int(t.get("alighting", 0)),
                "in_car_total": int(t.get("in_car", 0)),
            }

    stop_points = build_stop_keyword_points(scenario, grouping_method, legend_by_group if with_analytics else None)
    features.extend(stop_points)

    fc = {"type": "FeatureCollection", "features": features}
    return fc, Messages.BA_SEGMENT_LIST_RETRIEVED_JA
