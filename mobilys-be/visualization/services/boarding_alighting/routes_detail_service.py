# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict, Counter
from datetime import datetime, timedelta, time as dtime
from django.db.models import Min, Max
from rest_framework import status as http_status

from gtfs.models import (
    Scenario, Routes, Trips, StopTimes, Stops, Shape,
    StopNameKeywords, StopNameKeywordMap,
    StopIdKeyword, StopIdKeywordMap,
    RouteKeywords, RouteKeywordMap,
)

from gtfs.utils.route_data_utils import RouteDataUtils

from visualization.constants import (
    BOARDING_ALIGHTING_PATHS_CAP_PER_SEGMENT,
    BOARDING_ALIGHTING_LABEL_EAST_OFFSET_M,
    BOARDING_ALIGHTING_LABEL_NORTH_OFFSET_M,
)
from visualization.services.boarding_alighting.routes_analysis_helpers import (
    safe_int_zero,
    safe_int_or_none,
    round2,
    nearest_index,
    polyline_midpoint,
    freeze_path,
    parse_time_component,
    parse_time_range,
    time_in_range,
    trip_within_range,
    offset_point_east_north,
    resolve_routes,
)
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages

_PATHS_CAP_PER_SEGMENT = BOARDING_ALIGHTING_PATHS_CAP_PER_SEGMENT
_LABEL_EAST_OFFSET_M = BOARDING_ALIGHTING_LABEL_EAST_OFFSET_M
_LABEL_NORTH_OFFSET_M = BOARDING_ALIGHTING_LABEL_NORTH_OFFSET_M


def build_boarding_alighting_click_detail(body):
    """
    Build click-detail summary for a route segment or stop.

    Parameters:
    - body (dict): Request payload.
    - scenario_id (str): Scenario identifier.
    - route_id (str|None): Target route id.
    - route_group(s) (str|list[str]|None): Route groups to include.
    - date (str|None): Service date (YYYYMMDD).
    - type (str): in_car | boarding | alighting.
    - mode (str): segment | stop.
    - label (dict): Segment/stop label object.
    - start_time (str|None): Start time (HH:MM:SS).
    - end_time (str|None): End time (HH:MM:SS).
    - data (list[dict]): Event rows.

    Returns:
    - tuple[dict, str]: (summary payload, message)
    """
    body = body or {}
    scenario_id = body.get("scenario_id")
    route_id    = body.get("route_id")
    top_date    = body.get("date")
    rows        = body.get("data") or []
    value_type  = (body.get("type") or "").strip().lower()     # in_car | boarding | alighting
    mode        = (body.get("mode") or "").strip().lower()     # segment | stop
    label       = body.get("label") or {}

    # time range
    start_str = (body.get("start_time") or "").strip()
    end_str   = (body.get("end_time") or "").strip()

    # route groups (opsional)
    rg = body.get("route_group")
    route_groups = list(body.get("route_groups") or ([] if not rg else [rg]))

    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    if not route_id and not route_groups:
        raise ServiceError(Messages.BA_ROUTE_SCOPE_REQUIRED_JA, "route scope missing", http_status.HTTP_400_BAD_REQUEST)
    if not value_type or value_type not in ("in_car", "boarding", "alighting"):
        raise ServiceError(Messages.BA_TYPE_INVALID_JA, "invalid type", http_status.HTTP_400_BAD_REQUEST)
    if mode not in ("segment", "stop"):
        raise ServiceError(Messages.BA_MODE_INVALID_JA, "invalid mode", http_status.HTTP_400_BAD_REQUEST)
    if top_date:
        try:
            datetime.strptime(top_date, "%Y%m%d")
        except ValueError:
            raise ServiceError(Messages.BA_DATE_FORMAT_YYYYMMDD_ONLY_JA, "invalid date", http_status.HTTP_400_BAD_REQUEST)
    try:
        start_t, end_t = parse_time_range(start_str, end_str)
    except ValueError as e:
        raise ServiceError(str(e), "invalid time range", http_status.HTTP_400_BAD_REQUEST)

    # ---- Scenario & scoping
    try:
        scenario = Scenario.objects.get(pk=scenario_id)
    except Scenario.DoesNotExist:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)

    grouping_method = (getattr(scenario, "stops_grouping_method", None) or "").lower()

    group_route_ids = set()
    if route_groups:
        kw_qs = RouteKeywords.objects.filter(scenario=scenario, keyword__in=route_groups).values_list("id", flat=True)
        if kw_qs:
            mapped = RouteKeywordMap.objects.filter(scenario=scenario, keyword_id__in=list(kw_qs)).values_list("route_id", flat=True)
            group_route_ids = set(mapped)

    if route_id:
        routes_scope = {route_id}
        if route_groups and route_id not in group_route_ids:
            return {"summary": {}}, Messages.BA_ROUTE_ID_NOT_IN_GROUP_JA
    else:
        routes_scope = set(group_route_ids)

    if not routes_scope:
        return {"summary": {}}, Messages.BA_NO_ROUTES_FOUND_JA

    # ---- Trips meta
    trips_qs = Trips.objects.filter(scenario=scenario, route_id__in=list(routes_scope))\
                            .values("trip_id", "shape_id", "direction_id", "route_id", "service_id")
    trips_gtfs = list(trips_qs)
    trip_meta  = {t["trip_id"]: t for t in trips_gtfs}
    trips_gtfs_set = {t["trip_id"] for t in trips_gtfs}

    filtered_rows = []
    for r in rows:
        if not isinstance(r, dict): continue
        if r.get("route_id") and r["route_id"] not in routes_scope: continue
        if top_date and r.get("date") and r["date"] != top_date:   continue
        filtered_rows.append(r)

    trips_from_data = {r.get("trip_id") for r in filtered_rows if r.get("trip_id")}
    target_trips = (trips_from_data & trips_gtfs_set) if trips_from_data else trips_gtfs_set

    if start_t and end_t and target_trips:
        agg = (StopTimes.objects.filter(scenario=scenario, trip_id__in=list(target_trips))
               .values("trip_id").annotate(min_dep=Min("departure_time"), max_arr=Max("arrival_time")))
        eligible = set()
        for a in agg:
            if a["min_dep"] is None or a["max_arr"] is None:
                continue
            if trip_within_range(a["min_dep"], a["max_arr"], start_t, end_t):
                eligible.add(a["trip_id"])
        target_trips &= eligible

    if not target_trips:
        return {"summary": {}}, Messages.BA_NO_TRIPS_FOUND_JA

    # ---- Stops & sequences
    stop_coord = {}
    for s in Stops.objects.filter(scenario=scenario).values("stop_id", "stop_lon", "stop_lat", "stop_name"):
        stop_coord[s["stop_id"]] = (float(s["stop_lon"]), float(s["stop_lat"]), s["stop_name"])

    st_for_trips = (StopTimes.objects.filter(scenario=scenario, trip_id__in=list(target_trips))
                    .values("trip_id", "stop_id", "stop_sequence")
                    .order_by("trip_id", "stop_sequence"))
    trip_stop_sequences, last_tid, buf = {}, None, []
    seq_index_map_by_trip = {}
    for row in st_for_trips:
        tid = row["trip_id"]
        if tid != last_tid and last_tid is not None:
            seq_with = [(r["stop_id"], int(r["stop_sequence"])) for r in buf]
            trip_stop_sequences[last_tid] = [sid for sid, _ in seq_with]
            seq_index_map_by_trip[last_tid] = {sseq: i for i, (_, sseq) in enumerate(seq_with)}
            buf = []
        buf.append(row); last_tid = tid
    if last_tid is not None:
        seq_with = [(r["stop_id"], int(r["stop_sequence"])) for r in buf]
        trip_stop_sequences[last_tid] = [sid for sid, _ in seq_with]
        seq_index_map_by_trip[last_tid] = {sseq: i for i, (_, sseq) in enumerate(seq_with)}

    if len(trip_stop_sequences) < len(target_trips):
        for tid in target_trips:
            if tid in trip_stop_sequences:
                continue

            rws = [
                r for r in filtered_rows
                if r.get("trip_id") == tid and safe_int_or_none(r.get("stop_sequence")) is not None
            ]
            rws = sorted(rws, key=lambda x: safe_int_or_none(x.get("stop_sequence")) or 0)

            seq_with: list[tuple[str, int]] = []
            for r in rws:
                sid = r.get("stop_id")
                if not sid:
                    continue
                sseq = safe_int_or_none(r.get("stop_sequence"))
                if sseq is None:
                    continue
                seq_with.append((sid, sseq))

            if seq_with:
                trip_stop_sequences[tid] = [sid for sid, _ in seq_with]
                seq_index_map_by_trip[tid] = {sseq: i for i, (sid, sseq) in enumerate(seq_with)}

    # ---- Events per POSITION (trip_id, index)
    from collections import defaultdict
    events_by_trip_pos = defaultdict(lambda: {"geton": 0, "getoff": 0})
    for r in filtered_rows:
        tid = r.get("trip_id")
        if not tid or tid not in target_trips:
            continue

        sseq_raw = r.get("stop_sequence")
        sseq = safe_int_or_none(sseq_raw)
        if sseq is None:
            continue

        idx = seq_index_map_by_trip.get(tid, {}).get(sseq)
        if idx is None:
            continue

        events_by_trip_pos[(tid, idx)]["geton"] += safe_int_zero(r.get("count_geton"))
        events_by_trip_pos[(tid, idx)]["getoff"] += safe_int_zero(r.get("count_getoff"))

    unique_stop_ids = {sid for seq in trip_stop_sequences.values() for sid in (seq or [])}

    def build_group_index():
        group_key_by_stop = {}
        members = defaultdict(list)
        meta = {}

        if grouping_method == "stop_name":
            name_maps = StopNameKeywordMap.objects.filter(scenario=scenario, stop_id__in=list(unique_stop_ids))\
                                                  .values("stop_id", "stop_name_group_id")
            gids = {m["stop_name_group_id"] for m in name_maps}
            kw_qs = StopNameKeywords.objects.filter(scenario=scenario, stop_group_id__in=list(gids))\
                                            .values("stop_group_id", "stop_name_keyword", "stop_names_long", "stop_names_lat")
            kw_by_id = {row["stop_group_id"]: row for row in kw_qs}
            for m in name_maps:
                gkey = f"name:{m['stop_name_group_id']}"
                group_key_by_stop[m["stop_id"]] = gkey
                members[gkey].append(m["stop_id"])
            for gkey, sids in members.items():
                gid = int(gkey.split("name:", 1)[1])
                row = kw_by_id.get(gid)
                parent = row["stop_name_keyword"] if row else gkey
                lon = float(row["stop_names_long"] or 0.0) if row else 0.0
                lat = float(row["stop_names_lat"] or 0.0) if row else 0.0
                if (not lon or not lat) and sids:
                    xs = ys = n = 0
                    for sid in sids:
                        if sid in stop_coord:
                            x, y, _ = stop_coord[sid]; xs += x; ys += y; n += 1
                    if n > 0: lon, lat = xs / n, ys / n
                meta[gkey] = {"parent": parent, "lon": lon, "lat": lat}

        elif grouping_method == "stop_id":
            id_maps = StopIdKeywordMap.objects.filter(scenario=scenario, stop_id__in=list(unique_stop_ids))\
                                              .values("stop_id", "stop_id_group_id")
            gids = {m["stop_id_group_id"] for m in id_maps}
            kw_qs = StopIdKeyword.objects.filter(scenario=scenario, stop_group_id__in=list(gids))\
                                         .values("stop_group_id", "stop_id_keyword", "stop_id_long", "stop_id_lat")
            kw_by_id = {row["stop_group_id"]: row for row in kw_qs}
            for m in id_maps:
                gkey = f"id:{m['stop_id_group_id']}"
                group_key_by_stop[m["stop_id"]] = gkey
                members[gkey].append(m["stop_id"])
            for gkey, sids in members.items():
                gid = int(gkey.split("id:", 1)[1])
                row = kw_by_id.get(gid)
                parent = row["stop_id_keyword"] if row else gkey
                lon = float(row["stop_id_long"] or 0.0) if row else 0.0
                lat = float(row["stop_id_lat"] or 0.0) if row else 0.0
                if (not lon or not lat) and sids:
                    xs = ys = n = 0
                    for sid in sids:
                        if sid in stop_coord:
                            x, y, _ = stop_coord[sid]; xs += x; ys += y; n += 1
                    if n > 0: lon, lat = xs / n, ys / n
                meta[gkey] = {"parent": parent, "lon": lon, "lat": lat}

        for sid in unique_stop_ids:
            if sid not in group_key_by_stop:
                gkey = f"stop:{sid}"
                group_key_by_stop[sid] = gkey
                if sid in stop_coord:
                    x, y, name = stop_coord[sid]
                    meta[gkey] = {"parent": name, "lon": float(x), "lat": float(y)}
        return group_key_by_stop, members, meta

    group_key_by_stop, group_members, group_meta = build_group_index()

    if mode == "segment":
        A = (label.get("from_keyword") or "").strip()
        B = (label.get("to_keyword") or "").strip()
        if not A or not B:
            raise ServiceError(Messages.BA_SEGMENT_LABEL_REQUIRED_JA, "missing label", http_status.HTTP_400_BAD_REQUEST)

        def make_bucket():
            return {
                "sum_load": 0, "occurs": 0, "trips": set(), "routes": set(),
                "max_occ": (-1, None), "sum_on": 0, "sum_off": 0,
            }

        acc = {"AB": make_bucket(), "BA": make_bucket()}
        per_route = defaultdict(lambda: {"AB": make_bucket(), "BA": make_bucket()})

        for tid, seq in trip_stop_sequences.items():
            if tid not in target_trips or len(seq) < 2:
                continue
            rid = trip_meta.get(tid, {}).get("route_id")
            load = 0
            for i, sid in enumerate(seq):
                ev = events_by_trip_pos.get((tid, i), {"geton": 0, "getoff": 0})
                load += int(ev["geton"]) - int(ev["getoff"])
                if load < 0: load = 0

                if i < len(seq) - 1:
                    nxt = seq[i + 1]
                    g_from = group_key_by_stop.get(sid)
                    g_to   = group_key_by_stop.get(nxt)
                    kw_from = group_meta.get(g_from, {}).get("parent", g_from)
                    kw_to   = group_meta.get(g_to,   {}).get("parent", g_to)

                    if kw_from == A and kw_to == B:
                        key = "AB"
                    elif kw_from == B and kw_to == A:
                        key = "BA"
                    else:
                        continue

                    ev_next = events_by_trip_pos.get((tid, i + 1), {"geton": 0, "getoff": 0})

                    buck = acc[key]
                    buck["sum_load"] += load
                    buck["occurs"]   += 1
                    buck["trips"].add(tid)
                    if rid: buck["routes"].add(rid)
                    if load > buck["max_occ"][0]:
                        buck["max_occ"] = (load, tid)
                    buck["sum_on"]  += int(ev["geton"]) + int(ev_next["geton"])
                    buck["sum_off"] += int(ev["getoff"]) + int(ev_next["getoff"])

                    if rid:
                        rb = per_route[rid][key]
                        rb["sum_load"] += load
                        rb["occurs"]   += 1
                        rb["trips"].add(tid)
                        rb["routes"].add(rid)
                        if load > rb["max_occ"][0]:
                            rb["max_occ"] = (load, tid)
                        rb["sum_on"]  += int(ev["geton"]) + int(ev_next["geton"])
                        rb["sum_off"] += int(ev["getoff"]) + int(ev_next["getoff"])

        def pack_bucket(b):
            peak = None
            if b["max_occ"][1]:
                dep = (StopTimes.objects.filter(scenario=scenario, trip_id=b["max_occ"][1])
                       .aggregate(md=Min("departure_time"))["md"])
                peak = {
                    "value": int(b["max_occ"][0]),
                    "trip_id": b["max_occ"][1],
                    "first_departure_time": (dep.isoformat() if dep else None),
                }
            avg = float(b["sum_load"]) / b["occurs"] if b["occurs"] else 0.0
            return {
                "trip_count": len(b["trips"]),
                "segment_occurrences": int(b["occurs"]),
                "avg_riders_per_segment": round(avg, 2),
                "sum_in_car": int(b["sum_load"]),
                "max_occupancy": peak,
                "totals": {"boardings": int(b["sum_on"]), "alightings": int(b["sum_off"])},
            }

        all_route_ids = set(per_route.keys()) | (acc["AB"]["routes"] | acc["BA"]["routes"])
        _, _, route_name_by_id = resolve_routes(scenario, all_route_ids)

        route_details = []
        for rid in sorted(all_route_ids, key=lambda x: (str(x) if x is not None else "")):
            dmap = per_route.get(rid, {"AB": make_bucket(), "BA": make_bucket()})
            ab = pack_bucket(dmap["AB"])
            ba = pack_bucket(dmap["BA"])
            route_details.append({
                "route_id": rid,
                "route_name": route_name_by_id.get(rid, rid),
                "directions": {"A>B": ab, "B>A": ba},
                "union": {
                    "trip_count": len(dmap["AB"]["trips"] | dmap["BA"]["trips"]),
                    "segment_occurrences": int(dmap["AB"]["occurs"] + dmap["BA"]["occurs"]),
                    "sum_in_car": int(dmap["AB"]["sum_load"] + dmap["BA"]["sum_load"]),  
                }
            })

        summary = {
            "mode": "segment",
            "pair": {"A": A, "B": B},
            "directions": {"A>B": pack_bucket(acc["AB"]), "B>A": pack_bucket(acc["BA"])},
            "union": {
                "route_count": len(acc["AB"]["routes"] | acc["BA"]["routes"]),
                "trip_count": len(acc["AB"]["trips"]  | acc["BA"]["trips"]),
                "segment_occurrences": int(acc["AB"]["occurs"] + acc["BA"]["occurs"]),
                "sum_in_car": int(acc["AB"]["sum_load"] + acc["BA"]["sum_load"]), 
            },
            "route_details": route_details,
        }
        return {"summary": summary}, Messages.BA_OK_EN

    keyword = (label.get("keyword") or "").strip()
    if not keyword:
        raise ServiceError(Messages.BA_STOP_LABEL_REQUIRED_JA, "missing label", http_status.HTTP_400_BAD_REQUEST)

    idx_filter = None
    for k in ("index", "stop_index", "sequence_index", "column_index", "occurrence_index"):
        if k in label and label[k] is not None:
            try:
                idx_filter = int(label[k])
            except Exception:
                pass
            break
    sseq_filter = None
    if label.get("stop_sequence") is not None:
        try:
            sseq_filter = int(label.get("stop_sequence"))
        except Exception:
            sseq_filter = None

    target_groups = [gk for gk, info in group_meta.items() if info.get("parent") == keyword]
    if not target_groups:
        return {"summary": {}}, Messages.BA_STOP_GROUP_NOT_FOUND_JA

    sids = set()
    for gk in target_groups:
        sids.update(group_members.get(gk, []))

    trips_hit, routes_hit = set(), set()
    sum_on = sum_off = 0

    trip_details = [] 
    values_for_overall_trip_avg = []  
    trip_avg_by_tid = {} 
    for tid, seq in trip_stop_sequences.items():
        if not seq or tid not in target_trips:
            continue

        occ_indices = [i for i, sid in enumerate(seq) if sid in sids]

        if idx_filter is not None:
            occ_indices = [i for i in occ_indices if i == idx_filter]
        if sseq_filter is not None:
            mapped_idx = seq_index_map_by_trip.get(tid, {}).get(sseq_filter)
            occ_indices = [i for i in occ_indices if mapped_idx is not None and i == mapped_idx]

        if not occ_indices:
            continue

        trips_hit.add(tid)
        rid = trip_meta.get(tid, {}).get("route_id")
        if rid:
            routes_hit.add(rid)

        load = 0
        per_occ_values = []    
        trip_sum_on = 0         
        trip_sum_off = 0        

        for i, sid in enumerate(seq):
            ev = events_by_trip_pos.get((tid, i), {"geton": 0, "getoff": 0})

            load += int(ev["geton"]) - int(ev["getoff"])
            if load < 0:
                load = 0

            if i in occ_indices:
                if value_type == "in_car":
                    val = int(load)
                elif value_type == "boarding":
                    val = int(ev["geton"])
                else:  # "alighting"
                    val = int(ev["getoff"])
                per_occ_values.append(val)

                trip_sum_on  += int(ev["geton"])
                trip_sum_off += int(ev["getoff"])

        if per_occ_values or (trip_sum_on > 0 or trip_sum_off > 0):
            if per_occ_values:
                trip_avg = float(sum(per_occ_values)) / len(per_occ_values)
                values_for_overall_trip_avg.append(trip_avg)
                trip_avg_by_tid[tid] = trip_avg

            sum_on  += trip_sum_on
            sum_off += trip_sum_off

            first_dep = (StopTimes.objects.filter(scenario=scenario, trip_id=tid)
                         .aggregate(md=Min("departure_time"))["md"])
            trip_details.append({
                "trip_id": tid,
                "route_id": rid,
                "boarded": int(trip_sum_on),
                "alighted": int(trip_sum_off),
                "first_departure_time": (first_dep.isoformat() if first_dep else None),
            })

    if not trips_hit:
        routes_sorted, route_names, route_name_by_id = resolve_routes(scenario, set())
        summary = {
            "mode": "stop",
            "type": value_type,
            "label": {"keyword": keyword},
            "route_count": 0,
            "route_names": [],
            "trip_count": 0,
            "trip_avg_value_overall": 0.0,
            "route_details": [],
            "trip_details": [],
            "totals": {"boardings": 0, "alightings": 0},
        }
        return {"summary": summary}, Messages.BA_OK_EN

    routes_sorted, route_names, route_name_by_id = resolve_routes(scenario, routes_hit)

    trips_by_route = defaultdict(list)
    for td in trip_details:
        trips_by_route[td["route_id"]].append(td)

    route_details = []
    for rid in sorted(routes_hit):
        tds = trips_by_route.get(rid, [])
        if not tds:
            continue
        tv = [trip_avg_by_tid.get(t["trip_id"]) for t in tds if trip_avg_by_tid.get(t["trip_id"]) is not None]
        avg_per_route = (sum(tv) / len(tv)) if tv else 0.0
        route_details.append({
            "route_id": rid,
            "route_name": route_name_by_id.get(rid, rid),
            "trip_count": len(tds),
            "trip_avg_value": round(avg_per_route, 2),
        })

    trip_avg_value_overall = round(sum(values_for_overall_trip_avg) / len(values_for_overall_trip_avg), 2) if values_for_overall_trip_avg else 0.0

    summary = {
        "mode": "stop",
        "type": value_type,                
        "label": {"keyword": keyword},
        "route_count": len(routes_hit),
        "route_names": [route_name_by_id.get(rid, rid) for rid in sorted(routes_hit)],
        "trip_count": len(trips_hit),
        "trip_avg_value_overall": trip_avg_value_overall,
        "route_details": route_details,
        "trip_details": sorted(trip_details, key=lambda x: (x["route_id"] or "", x["trip_id"] or "")),
        "totals": {"boardings": int(sum_on), "alightings": int(sum_off)},
    }
    return {"summary": summary}, Messages.BA_OK_EN
