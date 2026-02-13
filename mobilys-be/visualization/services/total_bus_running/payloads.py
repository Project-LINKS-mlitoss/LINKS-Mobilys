# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict

from gtfs.models import (
    Stops,
    StopNameKeywordMap,
    StopNameKeywords,
    StopIdKeywordMap,
    StopIdKeyword,
    RouteKeywordMap,
    RouteKeywords,
    StopTimes,
)

from visualization.services.total_bus_running.core import (
    filter_trips,
    apply_calendar,
    apply_time_window,
    build_trip_map,
    get_all_st,
    build_trip_pattern_maps,
    build_route_details,
    compute_route_groups,
    compute_route_group_graph,
    compute_stop_group_graph,
    compute_route_group_total_graph,
)
from visualization.services.total_bus_running.edges import (
    filter_trips_on_stop_detail,
    get_all_st_data,
    get_stop_counts_from_db,
    compute_route_group_graph_optimized,
    compute_route_group_total_graph_optimized,
    compute_parent_edges_optimized,
    compute_child_edges,
    compute_child_stop_details,
)
from visualization.constants import StopGroupingMethod, StopGroupingLabel

def build_total_bus_on_stops_payload(scenario, date, start_time, end_time, rg_ids, dir_id, svcs):
    """
    Build response payload for total-bus-on-stops.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - date (datetime.date|None): Service date.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.
    - rg_ids (list[UUID]|None): Route group IDs.
    - dir_id (int|None): Direction filter.
    - svcs (list[str]|None): Service IDs.

    Returns:
    - dict: Response data payload.
    """
    trip_qs = filter_trips(scenario, svcs, dir_id, rg_ids)
    if date:
        trip_qs = apply_calendar(trip_qs, scenario, date)
    trip_qs, valid_tids = apply_time_window(trip_qs, scenario, start_time, end_time)

    trip_map = build_trip_map(trip_qs)
    all_st = get_all_st(scenario, valid_tids)

    valid_sids = set(rec.stop_id for rec in all_st)
    stops = Stops.objects.filter(scenario=scenario, stop_id__in=valid_sids)
    stops_data = [
        {"stop_id": s.stop_id, "stop_name": s.stop_name, "stop_lat": s.stop_lat, "stop_lon": s.stop_lon}
        for s in stops
    ]

    kw_objs, grp2routes, routes_group = compute_route_groups(scenario, rg_ids)
    route_group_graph = compute_route_group_graph(all_st, trip_map, kw_objs, grp2routes)
    stop_group_graph = compute_stop_group_graph(scenario, all_st)
    route_group_total_graph = compute_route_group_total_graph(
        scenario, all_st, trip_map, grp2routes, kw_objs, start_time, end_time
    )
    edges = compute_child_edges(all_st, trip_map, grp2routes, stops_data, kw_objs)

    return {
        "routes_group": routes_group,
        "stops": stops_data,
        "route_group_graph": route_group_graph,
        "stop_group_graph": stop_group_graph,
        "route_group_total_graph": route_group_total_graph,
        "edges": edges,
    }


def build_total_bus_on_stops_by_parents_payload(scenario, date, start_time, end_time, rg_ids, dir_id, svcs):
    """
    Build response payload for parent-grouped total-bus-on-stops.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - date (datetime.date|None): Service date.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.
    - rg_ids (list[UUID]|None): Route group IDs.
    - dir_id (int|None): Direction filter.
    - svcs (list[str]|None): Service IDs.

    Returns:
    - dict: Response data payload.
    """
    trip_qs = filter_trips(scenario, svcs, dir_id, rg_ids)
    if date:
        trip_qs = apply_calendar(trip_qs, scenario, date)
    trip_qs, valid_tids = apply_time_window(trip_qs, scenario, start_time, end_time)

    trip_map = build_trip_map(trip_qs)
    all_st_data = get_all_st_data(scenario, valid_tids)
    stops_cnt = get_stop_counts_from_db(scenario, valid_tids)

    use_name = scenario.stops_grouping_method == StopGroupingMethod.STOP_NAME
    MapModel = StopNameKeywordMap if use_name else StopIdKeywordMap
    parent_fld = "stop_name_group_id" if use_name else "stop_id_group_id"
    KWModel = StopNameKeywords if use_name else StopIdKeyword
    kw_attr = "stop_name_keyword" if use_name else "stop_id_keyword"

    grp2stops = defaultdict(list)
    stop2parent = {}
    for m in MapModel.objects.filter(scenario=scenario).values(parent_fld, "stop_id"):
        pid = int(m[parent_fld])
        sid = m["stop_id"]
        grp2stops[pid].append(sid)
        stop2parent[sid] = pid

    parent_names = {
        p.stop_group_id: getattr(p, kw_attr)
        for p in KWModel.objects.filter(scenario=scenario).only("stop_group_id", kw_attr)
    }

    valid_parents = [
        pid for pid, sids in grp2stops.items()
        if any(s in stops_cnt for s in sids)
    ]

    all_child_stops = [sid for pid in valid_parents for sid in grp2stops[pid]]
    coords = defaultdict(list)

    for s in Stops.objects.filter(
        scenario=scenario,
        stop_id__in=all_child_stops
    ).values("stop_id", "stop_lat", "stop_lon"):
        parent_id = stop2parent[s["stop_id"]]
        coords[parent_id].append((s["stop_lat"], s["stop_lon"]))

    stops_data = []
    for pid in valid_parents:
        pts = coords[pid]
        if pts:
            stops_data.append({
                "stop_id": pid,
                "stop_name": parent_names.get(pid),
                "stop_lat": sum(p[0] for p in pts) / len(pts),
                "stop_lon": sum(p[1] for p in pts) / len(pts),
            })

    kw_objs, grp2routes, routes_group = compute_route_groups(scenario, rg_ids)

    route_group_graph = compute_route_group_graph_optimized(
        all_st_data, trip_map, kw_objs, grp2routes
    )

    stop_group_graph = {
        "grouping_method": StopGroupingLabel.STOP_NAME if use_name else StopGroupingLabel.STOP_ID,
        "group_data": [
            {
                "parent": parent_names.get(pid),
                "childs": [
                    {"name": sid, "frequency": stops_cnt.get(sid, 0)}
                    for sid in grp2stops[pid]
                ]
            }
            for pid in valid_parents
        ]
    }

    route_group_total_graph = compute_route_group_total_graph_optimized(
        scenario, valid_tids, trip_map, grp2routes, kw_objs, start_time, end_time
    )

    edges = compute_parent_edges_optimized(
        all_st_data, trip_map, grp2routes, stops_data, stop2parent, kw_objs
    )

    return {
        "routes_group": routes_group,
        "stops": stops_data,
        "route_group_graph": route_group_graph,
        "stop_group_graph": stop_group_graph,
        "route_group_total_graph": route_group_total_graph,
        "edges": edges,
    }


def build_total_bus_on_stop_group_detail_payload(
    scenario,
    parent_id,
    date=None,
    start_time=None,
    end_time=None,
    service_ids=None,
    direction_id=None,
    route_group_ids=None,
):
    """
    Build response payload for a stop-group detail.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - parent_id (int): Parent stop group ID.
    - date (datetime.date|None): Service date.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.
    - service_ids (list[str]|None): Service IDs.
    - direction_id (int|None): Direction filter.
    - route_group_ids (list[UUID]|None): Route group IDs.

    Returns:
    - tuple: (parent_label, stops_details).
    """
    use_name = scenario.stops_grouping_method == StopGroupingMethod.STOP_NAME
    ParentMap = StopNameKeywordMap if use_name else StopIdKeywordMap
    parent_fld = "stop_name_group_id" if use_name else "stop_id_group_id"
    ParentKW = StopNameKeywords if use_name else StopIdKeyword
    kw_attr = "stop_name_keyword" if use_name else "stop_id_keyword"

    try:
        pid = int(parent_id)
    except (TypeError, ValueError):
        pid = parent_id

    try:
        pkw = ParentKW.objects.get(scenario=scenario, stop_group_id=pid)
        parent_label = getattr(pkw, kw_attr)
    except ParentKW.DoesNotExist:
        parent_label = str(pid)

    children = list(
        ParentMap.objects
        .filter(scenario=scenario, **{parent_fld: pid})
        .values_list("stop_id", flat=True)
    )
    if not children:
        return parent_label, []

    stops_qs = Stops.objects.filter(scenario=scenario, stop_id__in=children)
    stops_map = {
        s.stop_id: {
            "stop_id": s.stop_id,
            "stop_name": s.stop_name,
            "stop_lat": s.stop_lat,
            "stop_lon": s.stop_lon,
        }
        for s in stops_qs
    }

    trip_qs, valid_tids, trip_map = filter_trips_on_stop_detail(
        scenario,
        date=date,
        start_time=start_time,
        end_time=end_time,
        service_ids=service_ids,
        direction_id=direction_id,
        route_group_ids=route_group_ids
    )

    trip_list = list(trip_qs)
    trip_to_pattern, pattern_details = build_trip_pattern_maps(scenario, trip_list)
    route_ids = {trip.route_id for trip in trip_list if trip.route_id}
    route_details = build_route_details(scenario, route_ids)
    trips_info = {
        trip.trip_id: {
            "direction_id": trip.direction_id,
            "service_id": trip.service_id,
        }
        for trip in trip_list
    }

    all_st = StopTimes.objects.filter(
        scenario=scenario,
        trip_id__in=valid_tids,
        stop_id__in=children
    )

    rmap = RouteKeywordMap.objects.filter(scenario=scenario)
    grp2routes = defaultdict(list)
    for m in rmap.values("keyword_id", "route_id"):
        grp2routes[m["keyword_id"]].append(m["route_id"])
    kw_qs = RouteKeywords.objects.filter(scenario=scenario)
    kw_objs = {kw.id: kw for kw in kw_qs}

    stops_details = compute_child_stop_details(
        all_st=all_st,
        trip_map=trip_map,
        grp2routes=grp2routes,
        kw_objs=kw_objs,
        children_stop_ids=children,
        stops_map=stops_map,
        t_info=trips_info,
        trip_to_pattern=trip_to_pattern,
        pattern_details=pattern_details,
        route_details=route_details,
    )

    return parent_label, stops_details


def build_total_bus_on_stop_detail_payload(
    scenario,
    stop_id,
    date=None,
    start_time=None,
    end_time=None,
    service_ids=None,
    direction_id=None,
    route_group_ids=None,
):
    """
    Build response payload for a single stop detail.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - stop_id (str): Stop ID.
    - date (datetime.date|None): Service date.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.
    - service_ids (list[str]|None): Service IDs.
    - direction_id (int|None): Direction filter.
    - route_group_ids (list[UUID]|None): Route group IDs.

    Returns:
    - dict: Stop detail payload.
    """
    children = [stop_id]
    children = [stop_id]

    stops_qs = Stops.objects.filter(scenario=scenario, stop_id=stop_id)
    stops_map = {
        s.stop_id: {
            "stop_id": s.stop_id,
            "stop_name": s.stop_name,
            "stop_lat": s.stop_lat,
            "stop_lon": s.stop_lon,
        }
        for s in stops_qs
    }

    trip_qs, valid_tids, trip_map = filter_trips_on_stop_detail(
        scenario,
        date=date,
        start_time=start_time,
        end_time=end_time,
        service_ids=service_ids,
        direction_id=direction_id,
        route_group_ids=route_group_ids
    )

    trip_list = list(trip_qs)
    trip_to_pattern, pattern_details = build_trip_pattern_maps(scenario, trip_list)
    route_ids = {trip.route_id for trip in trip_list if trip.route_id}
    route_details = build_route_details(scenario, route_ids)

    all_st = StopTimes.objects.filter(
        scenario=scenario,
        trip_id__in=valid_tids,
        stop_id=stop_id
    )

    rmap = RouteKeywordMap.objects.filter(scenario=scenario)
    grp2routes = defaultdict(list)
    for m in rmap.values("keyword_id", "route_id"):
        grp2routes[m["keyword_id"]].append(m["route_id"])

    kw_qs = RouteKeywords.objects.filter(scenario=scenario)
    kw_objs = {kw.id: kw for kw in kw_qs}

    trips_info = {
        trip.trip_id: {
            "direction_id": trip.direction_id,
            "service_id": trip.service_id,
        }
        for trip in trip_list
    }

    details = compute_child_stop_details(
        all_st=all_st,
        trip_map=trip_map,
        grp2routes=grp2routes,
        kw_objs=kw_objs,
        children_stop_ids=children,
        stops_map=stops_map,
        t_info=trips_info,
        trip_to_pattern=trip_to_pattern,
        pattern_details=pattern_details,
        route_details=route_details,
    )

    return details[0] if details else {
        "stop_id": stop_id,
        "stop_name": "",
        "stop_lat": None,
        "stop_lon": None,
        "route_groups": []
    }
