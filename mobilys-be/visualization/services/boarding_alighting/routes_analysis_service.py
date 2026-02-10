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


def build_group_index_for_routes(
    scenario: Scenario,
    grouping_method: str,
    unique_stop_ids: set,
    stop_coord: dict,
):
    """
    Build grouping index and metadata for stop groups within a route.
    """
    group_key_by_stop = {}
    members = defaultdict(list)
    meta = {}

    if grouping_method == "stop_name":
        name_maps = StopNameKeywordMap.objects.filter(
            scenario=scenario, stop_id__in=list(unique_stop_ids)
        ).values("stop_id", "stop_name_group_id")

        gids = {m["stop_name_group_id"] for m in name_maps}
        kw_qs = StopNameKeywords.objects.filter(
            scenario=scenario, stop_group_id__in=list(gids)
        ).values("stop_group_id", "stop_name_keyword", "stop_names_long", "stop_names_lat")
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
                        x, y, _ = stop_coord[sid]
                        xs += x
                        ys += y
                        n += 1
                if n > 0:
                    lon, lat = xs / n, ys / n
            meta[gkey] = {"parent": parent, "lon": lon, "lat": lat}

    elif grouping_method == "stop_id":
        id_maps = StopIdKeywordMap.objects.filter(
            scenario=scenario, stop_id__in=list(unique_stop_ids)
        ).values("stop_id", "stop_id_group_id")

        gids = {m["stop_id_group_id"] for m in id_maps}
        kw_qs = StopIdKeyword.objects.filter(
            scenario=scenario, stop_group_id__in=list(gids)
        ).values("stop_group_id", "stop_id_keyword", "stop_id_long", "stop_id_lat")
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
                        x, y, _ = stop_coord[sid]
                        xs += x
                        ys += y
                        n += 1
                if n > 0:
                    lon, lat = xs / n, ys / n
            meta[gkey] = {"parent": parent, "lon": lon, "lat": lat}

    for sid in unique_stop_ids:
        if sid not in group_key_by_stop:
            gkey = f"stop:{sid}"
            group_key_by_stop[sid] = gkey
            if sid in stop_coord:
                x, y, name = stop_coord[sid]
                meta[gkey] = {"parent": name, "lon": float(x), "lat": float(y)}

    return group_key_by_stop, members, meta


def avg_values(values):
    """Compute average for a list of numeric values."""
    return float(sum(values)) / len(values) if values else 0.0


def aggregate_stats(nums):
    """Compute max/average/total stats for numeric list."""
    if not nums:
        return {"maximum": 0, "average": 0, "total": 0}
    total = float(sum(nums))
    avgv = total / len(nums)
    return {"maximum": float(max(nums)), "average": round2(avgv), "total": float(total)}


def trip_rows_for_sequence(
    tid: str,
    canonical_seq: list,
    events_by_trip_pos: dict,
    load_after_index_by_trip: dict,
    stop_name_map: dict,
):
    """
    Build per-stop graph rows for a single trip whose stop sequence matches canonical_seq.
    """
    rows = []
    lad = load_after_index_by_trip.get(tid) or []
    for idx, sid in enumerate(canonical_seq):
        ev = events_by_trip_pos.get((tid, idx))
        geton = int(ev["geton"]) if ev else 0
        getoff = int(ev["getoff"]) if ev else 0

        if lad and idx < len(lad):
            in_bus = int(lad[idx])
        else:
            prev = rows[-1]["count_in_bus"] if rows else 0
            in_bus = int(prev + geton - getoff)

        rows.append(
            {
                "stop_name": stop_name_map.get(sid, str(sid)),
                "count_geton": geton,
                "count_getoff": getoff,
                "count_in_bus": in_bus,
            }
        )
    return rows

def build_boarding_alighting_routes(body):
    body = body or {}
    scenario_id = body.get("scenario_id")
    route_id = body.get("route_id")
    top_date = body.get("date")
    trip_filter = (body.get("trip_id") or "all").strip().lower()
    rows = body.get("data") or []
    value_type = (body.get("type") or "").strip().lower()  # in_car | boarding | alighting

    # --- CHANGED: start_time & end_time (range) ---
    start_str = (body.get("start_time") or "").strip()
    end_str   = (body.get("end_time") or "").strip()

    # route groups (opsional)
    rg = body.get("route_group")
    route_groups = list(body.get("route_groups") or ([] if not rg else [rg]))

    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    if not route_id and not route_groups:
        raise ServiceError(Messages.BA_ROUTE_SCOPE_REQUIRED_JA, "route scope missing", http_status.HTTP_400_BAD_REQUEST)
    if not value_type:
        raise ServiceError(Messages.BA_TYPE_REQUIRED_JA, "type missing", http_status.HTTP_400_BAD_REQUEST)
    if value_type not in ("in_car", "boarding", "alighting"):
        raise ServiceError(Messages.BA_TYPE_INVALID_SPECIFY_JA, "invalid type", http_status.HTTP_400_BAD_REQUEST)

    if top_date:
        try:
            datetime.strptime(top_date, "%Y%m%d")
        except ValueError:
            raise ServiceError(Messages.BA_DATE_FORMAT_YYYYMMDD_JA, "invalid date format", http_status.HTTP_400_BAD_REQUEST)

    try:
        start_t, end_t = parse_time_range(start_str, end_str)
    except ValueError as e:
        raise ServiceError(str(e), "invalid time range", http_status.HTTP_400_BAD_REQUEST)

    try:
        scenario = Scenario.objects.get(pk=scenario_id)
    except Scenario.DoesNotExist:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)

    grouping_method = (getattr(scenario, "stops_grouping_method", None) or "").lower()

    group_route_ids = set()
    if route_groups:
        kw_qs = RouteKeywords.objects.filter(scenario=scenario, keyword__in=route_groups)\
                                     .values_list("id", flat=True)
        if kw_qs:
            mapped = RouteKeywordMap.objects.filter(scenario=scenario, keyword_id__in=list(kw_qs))\
                                            .values_list("route_id", flat=True)
            group_route_ids = set(mapped)

    if route_id:
        routes_scope = {route_id}
        if route_groups and route_id not in group_route_ids:
            return {"type": "FeatureCollection", "features": []}, Messages.BA_ROUTE_ID_NOT_IN_GROUP_JA
    else:
        routes_scope = set(group_route_ids)

    if not routes_scope:
        return {"type": "FeatureCollection", "features": []}, Messages.BA_NO_ROUTES_FOUND_JA

    routes_sorted, route_names, route_name_by_id = resolve_routes(scenario, routes_scope)

    trips_qs = Trips.objects.filter(scenario=scenario, route_id__in=list(routes_scope))\
                            .values("trip_id", "shape_id", "direction_id", "route_id", "service_id")
    trips_gtfs = list(trips_qs)
    trips_gtfs_set = {t["trip_id"] for t in trips_gtfs}
    trip_meta = {t["trip_id"]: t for t in trips_gtfs}
    trip_shape_id = {t["trip_id"]: t["shape_id"] for t in trips_gtfs}

    filtered_rows = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if r.get("route_id") and r["route_id"] not in routes_scope:
            continue
        if top_date and r.get("date") and r["date"] != top_date:
            continue
        filtered_rows.append(r)

    if trip_filter != "all":
        target_trips = {trip_filter}
    else:
        trips_from_data = {r.get("trip_id") for r in filtered_rows if r.get("trip_id")}
        target_trips = (trips_from_data & trips_gtfs_set) if trips_from_data else trips_gtfs_set

    if start_t and end_t and target_trips:
        agg = (StopTimes.objects.filter(scenario=scenario, trip_id__in=list(target_trips))
               .values("trip_id").annotate(min_dep=Min("departure_time"), max_arr=Max("arrival_time")))
        eligible = set()
        for a in agg:
            md, ma = a["min_dep"], a["max_arr"]
            if md is None or ma is None:
                continue
            if trip_within_range(md, ma, start_t, end_t):
                eligible.add(a["trip_id"])
        target_trips &= eligible

    if not target_trips:
        return {"type": "FeatureCollection", "features": []}, Messages.BA_NO_TRIPS_FOUND_JA

    stop_coord = {}
    for s in Stops.objects.filter(scenario=scenario)\
                          .values("stop_id", "stop_lon", "stop_lat", "stop_name"):
        stop_coord[s["stop_id"]] = (float(s["stop_lon"]), float(s["stop_lat"]), s["stop_name"])

    shape_ids = {trip_shape_id[tid] for tid in target_trips if trip_shape_id.get(tid)}
    shapes_map = {}
    if shape_ids:
        shp_points = (Shape.objects.filter(scenario=scenario, shape_id__in=shape_ids)
                      .values("shape_id", "shape_pt_lon", "shape_pt_lat", "shape_pt_sequence")
                      .order_by("shape_id", "shape_pt_sequence"))
        for row in shp_points:
            sid = row["shape_id"]
            shapes_map.setdefault(sid, []).append([float(row["shape_pt_lon"]), float(row["shape_pt_lat"])])
    trip_to_shape_coords = {}
    for tid in target_trips:
        sid = trip_shape_id.get(tid)
        if sid and sid in shapes_map:
            trip_to_shape_coords[tid] = shapes_map[sid]

    trip_stop_sequences = {}                      
    trip_stop_sequences_with_seq = {}             

    st_for_trips = StopTimes.objects.filter(
        scenario=scenario, trip_id__in=list(target_trips)
    ).values("trip_id", "stop_id", "stop_sequence").order_by("trip_id", "stop_sequence")

    last_tid, buf = None, []
    for row in st_for_trips:
        tid = row["trip_id"]
        if tid != last_tid and last_tid is not None:
            trip_stop_sequences[last_tid] = [r["stop_id"] for r in buf]
            trip_stop_sequences_with_seq[last_tid] = [(r["stop_id"], int(r["stop_sequence"])) for r in buf]
            buf = []
        buf.append(row); last_tid = tid
    if last_tid is not None:
        trip_stop_sequences[last_tid] = [r["stop_id"] for r in buf]
        trip_stop_sequences_with_seq[last_tid] = [(r["stop_id"], int(r["stop_sequence"])) for r in buf]

    # fallback dari data payload (kalau StopTimes ga lengkap)
    if len(trip_stop_sequences) < len(target_trips):
        for tid in target_trips:
            if tid in trip_stop_sequences:
                continue

            # Only keep rows with a valid numeric stop_sequence
            rws = [
                r for r in filtered_rows
                if r.get("trip_id") == tid and safe_int_or_none(r.get("stop_sequence")) is not None
            ]
            rws = sorted(rws, key=lambda x: safe_int_or_none(x.get("stop_sequence")) or 0)

            seq_ids: list[str] = []
            seq_with: list[tuple[str, int]] = []

            for r in rws:
                sid = r.get("stop_id")
                if not sid:
                    continue
                sseq = safe_int_or_none(r.get("stop_sequence"))
                if sseq is None:
                    continue

                seq_ids.append(sid)
                seq_with.append((sid, sseq))

            if seq_ids:
                trip_stop_sequences[tid] = seq_ids
                trip_stop_sequences_with_seq[tid] = seq_with

    events_by_trip_pos = defaultdict(lambda: {"geton": 0, "getoff": 0})
    stop_totals = defaultdict(lambda: {"geton": 0, "getoff": 0}) 

    seq_index_map_by_trip = {}
    for tid, seq_with in trip_stop_sequences_with_seq.items():
        seq_index_map_by_trip[tid] = {sseq: idx for idx, (_, sseq) in enumerate(seq_with)}

    for r in filtered_rows:
        tid = r.get("trip_id")
        sid = r.get("stop_id")
        if not tid or not sid or tid not in target_trips:
            continue

        go = safe_int_zero(r.get("count_geton"))
        gf = safe_int_zero(r.get("count_getoff"))

        stop_totals[sid]["geton"] += go
        stop_totals[sid]["getoff"] += gf

        sseq_raw = r.get("stop_sequence")
        sseq = safe_int_or_none(sseq_raw)
        if sseq is None:
            continue

        idx = seq_index_map_by_trip.get(tid, {}).get(sseq)
        if idx is None:
            continue

        events_by_trip_pos[(tid, idx)]["geton"] += go
        events_by_trip_pos[(tid, idx)]["getoff"] += gf

    loads_by_from_stop = defaultdict(list)
    load_after_index_by_trip = {}
    unique_stop_ids = set()

    for tid, seq in trip_stop_sequences.items():
        if tid not in target_trips or not seq:
            continue
        load = 0
        lad_list = []
        for i, sid in enumerate(seq):
            unique_stop_ids.add(sid)
            ev = events_by_trip_pos.get((tid, i), {"geton": 0, "getoff": 0})
            load += ev["geton"] - ev["getoff"]
            if load < 0:
                load = 0
            lad_list.append(load)
            if i < len(seq) - 1:
                loads_by_from_stop[sid].append(load)
        load_after_index_by_trip[tid] = lad_list

    trip_lines = []
    for tid, seq in trip_stop_sequences.items():
        if tid not in target_trips:
            continue
        if tid in trip_to_shape_coords and len(trip_to_shape_coords[tid]) >= 2:
            base = trip_to_shape_coords[tid]
        else:
            coords = []
            for sid in seq:
                if sid in stop_coord:
                    lon, lat, _ = stop_coord[sid]
                    coords.append([lon, lat])
            if len(coords) < 2:
                continue
            base = coords
        trip_lines.append(base)

    events_by_trip_stop = defaultdict(lambda: {"geton": 0, "getoff": 0})
    for r in filtered_rows:
        tid, sid = r.get("trip_id"), r.get("stop_id")
        if not tid or not sid or tid not in target_trips:
            continue

        go = safe_int_zero(r.get("count_geton"))
        gf = safe_int_zero(r.get("count_getoff"))

        events_by_trip_stop[(tid, sid)]["geton"] += go
        events_by_trip_stop[(tid, sid)]["getoff"] += gf

    seg_values = defaultdict(list)
    loads_by_from_stop = defaultdict(list)
    stop_totals = defaultdict(lambda: {"geton": 0, "getoff": 0})
    unique_stop_ids = set()

    for tid, seq in trip_stop_sequences.items():
        if tid not in target_trips or not seq:
            continue
        load = 0
        for i, sid in enumerate(seq):
            unique_stop_ids.add(sid)
            ev = events_by_trip_stop.get((tid, sid), {"geton": 0, "getoff": 0})
            stop_totals[sid]["geton"] += ev["geton"]
            stop_totals[sid]["getoff"] += ev["getoff"]
            load += ev["geton"] - ev["getoff"]
            if load < 0:
                load = 0
            if i < len(seq) - 1:
                nxt = seq[i + 1]
                seg_values[(sid, nxt)].append(load)
                loads_by_from_stop[sid].append(load)

    group_key_by_stop, group_members, group_meta = build_group_index_for_routes(
        scenario, grouping_method, unique_stop_ids, stop_coord
    )

    count_in_bus_group = {}
    for gkey, sids in group_members.items():
        loads = []
        for sid in sids:
            loads.extend(loads_by_from_stop.get(sid, []))
        count_in_bus_group[gkey] = int(round(avg_values(loads))) if loads else 0

    geton_group = defaultdict(int)
    getoff_group = defaultdict(int)
    for gkey, sids in group_members.items():
        for sid in sids:
            tot = stop_totals.get(sid, {"geton": 0, "getoff": 0})
            geton_group[gkey] += int(tot["geton"])
            getoff_group[gkey] += int(tot["getoff"])

    ordered_group_keys, seen_groups = [], set()
    for seq in trip_stop_sequences.values():
        for sid in seq:
            gk = group_key_by_stop.get(sid)
            if gk and gk not in seen_groups:
                seen_groups.add(gk)
                ordered_group_keys.append(gk)

    stops_features = []
    for gk in ordered_group_keys:
        info = group_meta.get(gk, {})
        lon, lat = info.get("lon", 0.0), info.get("lat", 0.0)
        members = group_members.get(gk, [])
        stops_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "keyword": info.get("parent", gk),
                "members": members,
                "count_geton": geton_group[gk],
                "count_getoff": getoff_group[gk],
                "count_in_bus": count_in_bus_group.get(gk, 0),
            }
        })

    segment_labels = []

    if value_type == "in_car":
        agg_pairs = {}

        for tid, seq in trip_stop_sequences.items():
            if tid not in target_trips or len(seq) < 2:
                continue
            shape_line = trip_to_shape_coords.get(tid)
            load = 0
            for i, sid in enumerate(seq):
                ev = events_by_trip_pos.get((tid, i), {"geton": 0, "getoff": 0})
                load += int(ev["geton"]) - int(ev["getoff"])
                if load < 0:
                    load = 0
                if i < len(seq) - 1:
                    nxt = seq[i + 1]
                    g_from = group_key_by_stop.get(sid)
                    g_to = group_key_by_stop.get(nxt)
                    from_info = group_meta.get(g_from, {})
                    to_info = group_meta.get(g_to, {})
                    from_kw = from_info.get("parent", g_from)
                    to_kw = to_info.get("parent", g_to)

                    if shape_line and sid in stop_coord and nxt in stop_coord:
                        lonA, latA, _ = stop_coord[sid]
                        lonB, latB, _ = stop_coord[nxt]
                        iA = nearest_index(lonA, latA, shape_line)
                        iB = nearest_index(lonB, latB, shape_line)
                        seg_coords = shape_line[iA:iB+1] if iA <= iB else list(reversed(shape_line[iB:iA+1]))

                        mid = [(lonA + lonB) / 2.0, (latA + latB) / 2.0]

                        path_coords = seg_coords if len(seg_coords) >= 2 else [[lonA, latA], [lonB, latB]]
                    else:
                        fx, fy = float(from_info.get("lon", 0.0)), float(from_info.get("lat", 0.0))
                        tx, ty = float(to_info.get("lon", 0.0)), float(to_info.get("lat", 0.0))
                        mid = [(fx + tx) / 2.0, (fy + ty) / 2.0]
                        path_coords = [[fx, fy], [tx, ty]]

                    kw1, kw2 = (from_kw, to_kw) if from_kw <= to_kw else (to_kw, from_kw)
                    rec = agg_pairs.setdefault(
                        (kw1, kw2),
                        {"value": 0, "trips": 0, "mx": 0.0, "my": 0.0, "n": 0, "paths": set()}
                    )
                    rec["value"] += load
                    rec["trips"] += 1
                    rec["mx"] += mid[0]
                    rec["my"] += mid[1]
                    rec["n"] += 1

                    if len(rec["paths"]) < (_PATHS_CAP_PER_SEGMENT * 3):
                        rec["paths"].add(freeze_path(path_coords))

        for (kw1, kw2), rec in agg_pairs.items():
            if rec["n"] > 0:
                coord = [rec["mx"] / rec["n"], rec["my"] / rec["n"]]
            else:
                coord = [0.0, 0.0]

            paths_out = []
            for frozen in list(rec["paths"])[:_PATHS_CAP_PER_SEGMENT]:
                if not frozen:
                    continue
                paths_out.append([[pt[0], pt[1]] for pt in frozen])

            segment_labels.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coord},
                "properties": {
                    "from_keyword": kw1,
                    "to_keyword": kw2,
                    "segment_key": f"{kw1} - {kw2}",
                    "value": int(rec["value"]),
                    "trips": int(rec["trips"]),
                    "paths": paths_out
                }
            })

    else:
        trips_per_group = defaultdict(set)
        for tid, seq in trip_stop_sequences.items():
            if tid not in target_trips:
                continue
            present_groups = {group_key_by_stop.get(sid) for sid in seq if group_key_by_stop.get(sid)}
            for gk in present_groups:
                trips_per_group[gk].add(tid)

        for gk in ordered_group_keys:
            info = group_meta.get(gk, {})
            base_lon, base_lat = info.get("lon", 0.0), info.get("lat", 0.0)
            lon, lat = offset_point_east_north(
                base_lon, base_lat,
                east_m=_LABEL_EAST_OFFSET_M,
                north_m=_LABEL_NORTH_OFFSET_M
            )
            keyword = info.get("parent", gk)
            val = int(geton_group[gk]) if value_type == "boarding" else int(getoff_group[gk])
            segment_labels.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "keyword": keyword,
                    "value": val,
                    "trips": len(trips_per_group.get(gk, set())),
                    "anchor_of": {"lon": base_lon, "lat": base_lat}  
                }
            })

    get_on_vals = [f["properties"]["count_geton"] for f in stops_features]
    get_off_vals = [f["properties"]["count_getoff"] for f in stops_features]
    in_car_vals = [int(f["properties"].get("value", 0)) for f in segment_labels if "value" in f.get("properties", {})]
    stats = {
        "get_on": aggregate_stats(get_on_vals),
        "get_off": aggregate_stats(get_off_vals),
        "in_car": aggregate_stats(in_car_vals),
    }

    if not trip_lines:
        geometry = {"type": "LineString", "coordinates": []}
    elif len(trip_lines) == 1:
        geometry = {"type": "LineString", "coordinates": trip_lines[0]}
    else:
        geometry = {"type": "MultiLineString", "coordinates": trip_lines}

    all_dirs = [t["direction_id"] for t in trips_gtfs if t["trip_id"] in target_trips and t["direction_id"] is not None]
    direction_id = all_dirs[0] if all_dirs else None

    stop_name_map = {sid: data[2] for sid, data in stop_coord.items()}
    occ_index_by_trip = {}
    for tid, seq in trip_stop_sequences.items():
        if not seq:
            continue
        occ_map = {}
        seen_counts = {}
        for pos, sid in enumerate(seq):
            occ = seen_counts.get(sid, 0)
            occ_map[(sid, occ)] = pos
            seen_counts[sid] = occ + 1
        occ_index_by_trip[tid] = occ_map

    patterns = defaultdict(list)
    for tid in target_trips:
        meta_t = trip_meta.get(tid)
        if not meta_t:
            continue
        key = (meta_t["route_id"], meta_t["shape_id"], meta_t["direction_id"], meta_t["service_id"])
        patterns[key].append(tid)

    stop_name_map = {sid: name for sid, (_, _, name) in ((k, (v[0], v[1], v[2])) for k, v in stop_coord.items())}

    graphs_acc = {}  # key: (route_id, canonical_tuple)
    for (route_id_i, shape_id_i, direction_id_i, service_id_i), p_trips in patterns.items():
        seqs = [
            tuple(trip_stop_sequences.get(tid) or [])
            for tid in p_trips
            if trip_stop_sequences.get(tid)
        ]
        if not seqs:
            continue

        # canonical pattern = most common stop sequence
        cnt = Counter(seqs)
        canonical_tuple, _ = cnt.most_common(1)[0]
        canonical_seq = list(canonical_tuple)

        # Trips whose sequence is exactly the canonical sequence
        canonical_trips = [
            tid for tid in p_trips
            if tuple(trip_stop_sequences.get(tid) or []) == canonical_tuple
        ]

        # ALL trips for this pattern (regardless of being canonical or not)
        all_trips = [tid for tid in p_trips if trip_stop_sequences.get(tid)]

        first_sid = canonical_seq[0]
        last_sid = canonical_seq[-1]
        head_a = stop_name_map.get(first_sid, str(first_sid))
        head_b = stop_name_map.get(last_sid, str(last_sid))
        graph_label = f"{head_a} - {head_b}"

        acc_key = (route_id_i, canonical_tuple)
        rec = graphs_acc.setdefault(
            acc_key,
            {
                "graph_key": graph_label,
                "route_id": route_id_i,
                "seq": canonical_seq,
                "canonical_trip_ids": set(),
                "all_trip_ids": set(),
                "shape_ids": set(),
                "direction_ids": set(),
                "service_ids": set(),
            },
        )

        rec["canonical_trip_ids"].update(canonical_trips)
        rec["all_trip_ids"].update(all_trips)

        if shape_id_i is not None:
            rec["shape_ids"].add(shape_id_i)
        if direction_id_i is not None:
            rec["direction_ids"].add(direction_id_i)
        if service_id_i is not None:
            rec["service_ids"].add(service_id_i)

    graphs = []

    for (rid, seq_tuple), acc in graphs_acc.items():
        canonical_seq = acc["seq"]
        canonical_occ_index = []
        seen_counts = {}
        for sid in canonical_seq:
            occ = seen_counts.get(sid, 0)
            canonical_occ_index.append(occ)
            seen_counts[sid] = occ + 1

        graph_rows = []
        for idx, sid in enumerate(canonical_seq):
            stop_name = stop_name_map.get(sid, str(sid))
            occ = canonical_occ_index[idx]

            sum_on = 0
            sum_off = 0
            loads = []

            for tid in acc["all_trip_ids"]:
                occ_map = occ_index_by_trip.get(tid)
                if not occ_map:
                    continue

                pos = occ_map.get((sid, occ))
                if pos is None:
                    continue

                ev = events_by_trip_pos.get((tid, pos))
                if ev:
                    sum_on += int(ev["geton"])
                    sum_off += int(ev["getoff"])

                lad = load_after_index_by_trip.get(tid)
                if lad and pos < len(lad):
                    loads.append(int(lad[pos]))

            graph_rows.append(
                {
                    "stop_name": stop_name,
                    "count_geton": int(sum_on),
                    "count_getoff": int(sum_off),
                    "count_in_bus": int(sum(loads)),
                }
            )

        # Per-trip detail: keep using only canonical trips to guarantee sequence alignment
        trip_details = []
        for tid in sorted(acc["canonical_trip_ids"]):
            trip_details.append(
                {
                    "trip_id": tid,
                    "graph_data": trip_rows_for_sequence(
                        tid, canonical_seq, events_by_trip_pos, load_after_index_by_trip, stop_name_map
                    ),
                }
            )

        _graph_route_ids = [rid]
        _graph_route_names = [route_name_by_id.get(rid, rid)]
        graphs.append(
            {
                "graph_key": acc["graph_key"],
                "route_ids": _graph_route_ids,
                "route_names": _graph_route_names,
                "graph_data": graph_rows,
                "trips": trip_details,
            }
        )

    graphs.sort(key=lambda g: (g["route_ids"][0] or "", g["graph_key"]))


    props = {
        "feature_type": "route",
        "keyword": rg,
        "route_ids": routes_sorted,
        "route_names": route_names,            
        "direction_id": direction_id,
        "stops_features": stops_features,
        "segment_labels": segment_labels,
    }

    feature = {"type": "Feature", "geometry": geometry, "properties": props, "stats": stats}
    fc = {"type": "FeatureCollection", "features": [feature], "graphs": graphs}

    return fc, Messages.BA_AGGREGATION_COMPLETED_JA

