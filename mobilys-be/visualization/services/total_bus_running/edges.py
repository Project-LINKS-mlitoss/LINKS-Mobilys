from itertools import groupby
from collections import defaultdict, Counter
from shapely.geometry import LineString, MultiLineString
from shapely.ops import transform
import pyproj
from django.db.models import Min, Max, Count
from django.db.models.functions import Extract

from visualization.constants import (
    EPSG_WGS84,
    EPSG_WEB_MERCATOR,
    TIME_FORMAT,
    EDGE_OFFSET_M,
    EDGE_OFFSET_SIDE,
    Weekday,
)
from gtfs.models import (
    Trips,
    StopTimes,
    RouteKeywordMap,
    Calendar,
    CalendarDates,
)

def compute_parent_edges(
    all_st,
    trip_map,
    grp2routes,
    stops_data,
    stop2parent,
    kw_objs,
    OFFSET_M=EDGE_OFFSET_M
):
    """
    Compute parent-stop edges with offset geometry.

    Parameters:
    - all_st (QuerySet[StopTimes]): StopTimes for valid trips.
    - trip_map (dict): trip_id -> route_id.
    - grp2routes (dict): group_id -> route list.
    - stops_data (list[dict]): Stops with coordinates.
    - stop2parent (dict): stop_id -> parent_id.
    - kw_objs (dict): group_id -> RouteKeyword.
    - OFFSET_M (int): Offset in meters.

    Returns:
    - list[dict]: Edge list with geometry and counts.
    """
    parent_coords = {
        s["stop_id"]: (s["stop_lon"], s["stop_lat"])
        for s in stops_data
    }

    proj_to_m  = pyproj.Transformer.from_crs(EPSG_WGS84, EPSG_WEB_MERCATOR, always_xy=True).transform
    proj_to_ll = pyproj.Transformer.from_crs(EPSG_WEB_MERCATOR, EPSG_WGS84, always_xy=True).transform

    info_map = defaultdict(lambda: {"trip_count": 0, "group_ids": set()})
    sts = all_st.order_by("trip_id","stop_sequence").values("trip_id","stop_id")

    for trip_id, grp in groupby(sts, key=lambda r: r["trip_id"]):
        raw_seq = [r["stop_id"] for r in grp]
        parent_seq = []
        prev = None
        for sid in raw_seq:
            pid = stop2parent.get(sid)
            if pid and pid != prev:
                parent_seq.append(pid)
                prev = pid

        if len(parent_seq) < 2:
            continue

        rid = trip_map.get(trip_id)
        groups = [ gid for gid, routes in grp2routes.items() if rid in routes ]

        seen_pairs = set()
        for src, dst in zip(parent_seq, parent_seq[1:]):
            if src == dst:
                continue
            key = (src, dst)
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            info = info_map[key]
            info["trip_count"] += 1
            info["group_ids"].update(groups)

    edges = []
    for (src, dst), info in info_map.items():
        if src not in parent_coords or dst not in parent_coords:
            continue
            
        lon1, lat1 = parent_coords[src]
        lon2, lat2 = parent_coords[dst]

        line_ll = LineString([(lon1, lat1), (lon2, lat2)])
        line_m  = transform(proj_to_m, line_ll)
        off_m   = line_m.parallel_offset(OFFSET_M, EDGE_OFFSET_SIDE)
        off_ll  = transform(proj_to_ll, off_m)

        if isinstance(off_ll, MultiLineString):
            pts = [pt for part in off_ll.geoms for pt in part.coords]
        else:
            pts = list(off_ll.coords)

        colors      = [f"#{kw_objs[g].keyword_color}" for g in info["group_ids"]]
        route_grps  = [kw_objs[g].keyword            for g in info["group_ids"]]
        route_ids  = [kw_objs[g].id                  for g in info["group_ids"]]

        edges.append({
            "source":       src,
            "target":       dst,
            "trip_count":   info["trip_count"],
            "colors":       colors,
            "route_group_ids":    route_ids,
            "route_groups": route_grps,
            "geojson_data": pts,
        })

    return edges


def compute_child_edges(all_st, trip_map, grp2routes, child_stops_data, kw_objs, OFFSET_M=EDGE_OFFSET_M):
    """
    Compute edges for child stops (no parent grouping).

    Parameters:
    - all_st (QuerySet[StopTimes]): StopTimes for valid trips.
    - trip_map (dict): trip_id -> route_id.
    - grp2routes (dict): group_id -> route list.
    - child_stops_data (list[dict]): Stops with coordinates.
    - kw_objs (dict): group_id -> RouteKeyword.
    - OFFSET_M (int): Offset in meters.

    Returns:
    - list[dict]: Edge list with geometry and counts.
    """
    stop2parent = {s["stop_id"]:s["stop_id"] for s in child_stops_data}
    return compute_parent_edges(
        all_st, trip_map, grp2routes,
        stops_data=child_stops_data,
        stop2parent=stop2parent,
        kw_objs=kw_objs,
        OFFSET_M=OFFSET_M
    )


def compute_child_stop_details(
    all_st,
    trip_map,
    grp2routes,
    kw_objs,
    children_stop_ids,
    stops_map,
    t_info,
    trip_to_pattern,
    pattern_details,
    route_details=None
):
    """
    Build per-stop route/group/pattern details with trips.

    Parameters:
    - all_st (QuerySet[StopTimes]): StopTimes for valid trips and stops.
    - trip_map (dict): trip_id -> route_id.
    - grp2routes (dict): group_id -> route list.
    - kw_objs (dict): group_id -> RouteKeyword.
    - children_stop_ids (list[str]): Stop IDs to include.
    - stops_map (dict): stop_id -> stop detail.
    - t_info (dict): trip_id -> direction/service info.
    - trip_to_pattern (dict): trip_id -> pattern_id.
    - pattern_details (dict): pattern_id -> details.
    - route_details (dict|None): route_id -> details.

    Returns:
    - list[dict]: Stop details list.
    """
    route2groups = defaultdict(list)
    for gid, routes in grp2routes.items():
        for r in routes:
            route2groups[r].append(gid)

    result = []
    for stop_id in children_stop_ids:
        # per route group -> per route -> per pattern -> trips
        rg_map = defaultdict(lambda: defaultdict(dict))
        for rec in all_st.filter(stop_id=stop_id).values("trip_id","departure_time"):
            tid = rec["trip_id"]
            info = t_info.get(tid)
            dep = rec["departure_time"]
            rid = trip_map.get(tid)
            pattern_id = trip_to_pattern.get(tid)
            if rid is None or pattern_id is None:
                continue
            pattern_info = pattern_details.get(pattern_id, {})
            rid_str = str(rid)
            for gid in route2groups.get(rid, []):
                route_bucket = rg_map[gid][rid_str]
                bucket = route_bucket.get(pattern_id)
                if bucket is None:
                    bucket = {
                        "pattern_id": pattern_info.get("pattern_id", pattern_id),
                        "route_id": rid_str,
                        "shape_id": pattern_info.get("shape_id"),
                        "direction_id": pattern_info.get("direction_id"),
                        "service_id": pattern_info.get("service_id"),
                        "segment": pattern_info.get("segment"),
                        "first_stop_id": pattern_info.get("first_stop_id"),
                        "last_stop_id": pattern_info.get("last_stop_id"),
                        "is_direction_id_generated": pattern_info.get("is_direction_id_generated"),
                        "trips": [],
                    }
                    route_bucket[pattern_id] = bucket
                bucket["trips"].append({
                    "trip_id":        str(tid),
                    "departure_time": dep.strftime(TIME_FORMAT),
                    "direction_id": info['direction_id'] if info else bucket.get("direction_id"),
                    "service_id":    info['service_id'] if info else bucket.get("service_id"),
                })

        # assemble into list
        rg_list = []
        for gid, routes in rg_map.items():
            route_list = []
            for rid, patterns in routes.items():
                pattern_list = []
                for entry in patterns.values():
                    entry["trips"] = sorted(entry["trips"], key=lambda x: x["departure_time"])
                    entry["trip_count"] = len(entry["trips"])
                    pattern_list.append(entry)
                pattern_list.sort(key=lambda p: p.get("pattern_id", ""))
                route_meta = (route_details or {}).get(rid, {"route_id": rid})
                route_payload = {
                    **route_meta,
                    "route_id": route_meta.get("route_id", rid),
                    "route_patterns": pattern_list,
                }
                route_list.append(route_payload)
            route_list.sort(key=lambda r: r.get("route_id", ""))
            rg_list.append({
                "route_group_id":   str(gid),
                "route_group_name": kw_objs[gid].keyword,
                "routes":           route_list
            })

        stop_info = stops_map[stop_id]
        stop_info["route_groups"] = rg_list
        result.append(stop_info)

    return result


def filter_trips_on_stop_detail(
    scenario,
    date=None,
    start_time=None,
    end_time=None,
    service_ids=None,
    direction_id=None,
    route_group_ids=None,
):
    """
    Filter trips and build trip_map for stop detail endpoints.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - date (datetime.date|None): Service date.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.
    - service_ids (list[str]|None): Service IDs.
    - direction_id (int|None): Direction filter.
    - route_group_ids (list[UUID]|None): Route group filter.

    Returns:
    - tuple: (trip_qs, valid_trip_ids, trip_map).
    """
    qs = Trips.objects.filter(scenario=scenario)
    if service_ids:
        qs = qs.filter(service_id__in=service_ids)
    if direction_id is not None:
        qs = qs.filter(direction_id=direction_id)
    if route_group_ids:
        allowed = RouteKeywordMap.objects.filter(
            scenario=scenario,
            keyword_id__in=route_group_ids
        ).values_list("route_id", flat=True)
        qs = qs.filter(route_id__in=allowed)

    # calendar
    if date:
        wd = list(Weekday)[date.weekday()].value
        base = Calendar.objects.filter(
            scenario=scenario,
            start_date__lte=date, end_date__gte=date,
            **{wd: 1}
        ).values_list("service_id", flat=True)
        added = CalendarDates.objects.filter(
            scenario=scenario, date=date, exception_type=1
        ).values_list("service_id", flat=True)
        removed = CalendarDates.objects.filter(
            scenario=scenario, date=date, exception_type=2
        ).values_list("service_id", flat=True)
        valid = set(base) | set(added) - set(removed)
        qs = qs.filter(service_id__in=valid)

    # time window
    if start_time or end_time:
        agg = StopTimes.objects.filter(
            scenario=scenario,
            trip_id__in=qs.values_list("trip_id", flat=True)
        ).values("trip_id").annotate(
            earliest=Min("arrival_time"),
            latest=  Max("departure_time")
        )
        if start_time:
            agg = agg.filter(earliest__gte=start_time)
        if end_time:
            agg = agg.filter(latest__lte=end_time)
        valid_tids = list(agg.values_list("trip_id", flat=True))
        qs = qs.filter(trip_id__in=valid_tids)
    else:
        valid_tids = list(qs.values_list("trip_id", flat=True))

    # build trip_map
    trip_map = {
        tid: rid
        for tid, rid in qs.values_list("trip_id", "route_id")
    }

    return qs, valid_tids, trip_map

def get_all_st_data(scenario, valid_tids):
    """
    Fetch StopTimes as list of dicts for performance.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - valid_tids (list[str]): Valid trip IDs.

    Returns:
    - list[dict]: StopTimes rows.
    """
    return list(
        StopTimes.objects.filter(
            scenario=scenario,
            trip_id__in=valid_tids
        ).values('trip_id', 'stop_id', 'departure_time', 'stop_sequence')
    )


def get_stop_counts_from_db(scenario, valid_tids):
    """
    Get stop visit counts using DB aggregation.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - valid_tids (list[str]): Valid trip IDs.

    Returns:
    - dict: stop_id -> count.
    """
    return dict(
        StopTimes.objects.filter(
            scenario=scenario,
            trip_id__in=valid_tids
        ).values('stop_id').annotate(
            count=Count('stop_id')
        ).values_list('stop_id', 'count')
    )


def compute_route_group_graph_optimized(all_st_data, trip_map, kw_objs, grp2routes):
    """
    Compute route group graph using list-based StopTimes.

    Parameters:
    - all_st_data (list[dict]): StopTimes rows.
    - trip_map (dict): trip_id -> route_id.
    - kw_objs (dict): group_id -> RouteKeyword.
    - grp2routes (dict): group_id -> route list.

    Returns:
    - list[dict]: Route group graph data.
    """
    # Extract unique trip_ids from data
    valid_trip_ids = {rec['trip_id'] for rec in all_st_data}
    
    # Count trips per route
    cnt_per_route = Counter(
        trip_map[tid]
        for tid in valid_trip_ids
        if tid in trip_map
    )

    out = []
    for gid, routes in grp2routes.items():
        out.append({
            "group_name": kw_objs[gid].keyword,
            "childs": [
                {
                    "name": r,
                    "frequency": cnt_per_route.get(r, 0)
                } 
                for r in routes
            ]
        })
    return out


def compute_route_group_total_graph_optimized(scenario, valid_tids, trip_map, grp2routes, kw_objs, start_time, end_time):
    """
    Compute hourly route-group counts using DB aggregation.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - valid_tids (list[str]): Valid trip IDs.
    - trip_map (dict): trip_id -> route_id.
    - grp2routes (dict): group_id -> route list.
    - kw_objs (dict): group_id -> RouteKeyword.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.

    Returns:
    - list[dict]: Hourly graph data.
    """
    start_hr = start_time.hour if start_time else 0
    end_hr = end_time.hour if end_time else 23

    # Database aggregation untuk extract hour
    trip_hours_qs = StopTimes.objects.filter(
        scenario=scenario,
        trip_id__in=valid_tids
    ).values("trip_id").annotate(
        earliest_hour=Extract(Min("departure_time"), 'hour')
    )
    
    trip_hours = {
        item["trip_id"]: item["earliest_hour"] 
        for item in trip_hours_qs
    }

    # Build route -> groups mapping
    r2g = defaultdict(list)
    for gid, routes in grp2routes.items():
        for r in routes:
            r2g[r].append(kw_objs[gid].keyword)

    # Count trips per hour per group
    hr_counts = {g: Counter() for grp in r2g.values() for g in grp}
    for tid, hr in trip_hours.items():
        if hr is not None and start_hr <= hr <= end_hr:
            rid = trip_map.get(tid)
            if rid:
                for g in r2g.get(rid, []):
                    hr_counts[g][hr] += 1

    name2color = {kw.keyword: kw.keyword_color for kw in kw_objs.values()}
    all_groups = sorted(hr_counts.keys())

    result = []
    for h in range(start_hr, end_hr + 1):
        result.append({
            "hour": f"{h:02d}:00",
            "groups": [
                {
                    "name": g,
                    "value": hr_counts[g].get(h, 0),
                    "color": f"#{name2color[g]}"
                }
                for g in all_groups
            ]
        })
    return result


def compute_parent_edges_optimized(
    all_st_data,
    trip_map,
    grp2routes,
    stops_data,
    stop2parent,
    kw_objs,
    OFFSET_M=EDGE_OFFSET_M
):
    """
    Compute parent edges using list-based StopTimes.

    Parameters:
    - all_st_data (list[dict]): StopTimes rows.
    - trip_map (dict): trip_id -> route_id.
    - grp2routes (dict): group_id -> route list.
    - stops_data (list[dict]): Stops with coordinates.
    - stop2parent (dict): stop_id -> parent_id.
    - kw_objs (dict): group_id -> RouteKeyword.
    - OFFSET_M (int): Offset in meters.

    Returns:
    - list[dict]: Edge list with geometry and counts.
    """
    parent_coords = {
        s["stop_id"]: (s["stop_lon"], s["stop_lat"])
        for s in stops_data
    }

    proj_to_m = pyproj.Transformer.from_crs(EPSG_WGS84, EPSG_WEB_MERCATOR, always_xy=True).transform
    proj_to_ll = pyproj.Transformer.from_crs(EPSG_WEB_MERCATOR, EPSG_WGS84, always_xy=True).transform

    info_map = defaultdict(lambda: {"trip_count": 0, "group_ids": set()})
    
    # Sort data by trip_id and stop_sequence
    sorted_data = sorted(all_st_data, key=lambda x: (x['trip_id'], x['stop_sequence']))

    # Process each trip
    for trip_id, grp in groupby(sorted_data, key=lambda r: r['trip_id']):
        raw_seq = [r['stop_id'] for r in grp]
        
        # Build parent sequence
        parent_seq = []
        prev = None
        for sid in raw_seq:
            pid = stop2parent.get(sid)
            if pid and pid != prev:
                parent_seq.append(pid)
                prev = pid

        if len(parent_seq) < 2:
            continue

        rid = trip_map.get(trip_id)
        groups = [gid for gid, routes in grp2routes.items() if rid in routes]

        # Record edges
        seen_pairs = set()
        for src, dst in zip(parent_seq, parent_seq[1:]):
            if src == dst:
                continue
            key = (src, dst)
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            
            info = info_map[key]
            info["trip_count"] += 1
            info["group_ids"].update(groups)

    # Build edge geometries
    edges = []
    for (src, dst), info in info_map.items():
        if src not in parent_coords or dst not in parent_coords:
            continue
            
        lon1, lat1 = parent_coords[src]
        lon2, lat2 = parent_coords[dst]

        line_ll = LineString([(lon1, lat1), (lon2, lat2)])
        line_m = transform(proj_to_m, line_ll)
        off_m = line_m.parallel_offset(OFFSET_M, EDGE_OFFSET_SIDE)
        off_ll = transform(proj_to_ll, off_m)

        if isinstance(off_ll, MultiLineString):
            pts = [pt for part in off_ll.geoms for pt in part.coords]
        else:
            pts = list(off_ll.coords)

        colors = [f"#{kw_objs[g].keyword_color}" for g in info["group_ids"]]
        route_grps = [kw_objs[g].keyword for g in info["group_ids"]]
        route_ids = [kw_objs[g].id for g in info["group_ids"]]

        edges.append({
            "source": src,
            "target": dst,
            "trip_count": info["trip_count"],
            "colors": colors,
            "route_group_ids": route_ids,
            "route_groups": route_grps,
            "geojson_data": pts,
        })

    return edges
