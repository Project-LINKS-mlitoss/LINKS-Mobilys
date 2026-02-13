# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict
from datetime import datetime, time
from typing import List, Optional, Set, Tuple

from django.db.models import Q

from visualization.constants import (
    DATE_FORMAT,
    TIME_FORMAT,
    StopGroupingMethod,
    Weekday,
)
from gtfs.models import (
    Scenario,
    Routes,
    Trips,
    Stops,
    StopTimes,
    Shape,
    Calendar,
    CalendarDates,
    RouteKeywords,
    RouteKeywordMap,
    StopNameKeywordMap,
    StopNameKeywords,
    StopIdKeywordMap,
    StopIdKeyword,
)
from shapely.geometry import Polygon, Point
from visualization.constants.messages import Messages


def normalize_hex(value: Optional[str]) -> Optional[str]:
    """
    Normalize hex color strings into #RRGGBB or return None.

    Parameters:
    - value (str|None): Raw color value.

    Returns:
    - str|None: Normalized hex color.
    """
    if not value:
        return None
    s = str(value).strip()
    s = s[1:] if s.startswith("#") else s
    if len(s) == 3 or len(s) == 6:
        return f"#{s}"
    return None


def _parse_bool(raw: Optional[str], default: bool = False) -> bool:
    return (raw or str(default)).strip().lower() == "true"


def _parse_csv(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [x.strip() for x in raw.split(",") if x.strip()]


def _parse_time(raw: Optional[str]) -> Optional[time]:
    if not raw:
        return None
    fmt = TIME_FORMAT if raw.count(":") == 2 else "%H:%M"
    return datetime.strptime(raw, fmt).time()


def _parse_date(raw: Optional[str]):
    if not raw:
        return None
    return datetime.strptime(raw, DATE_FORMAT).date()


def _weekday_field(d) -> str:
    return list(Weekday)[d.weekday()].value


def _active_services_on_date(scenario_id, date_obj) -> Set[str]:
    if not date_obj:
        return set()
    day_field = _weekday_field(date_obj)
    base_qs = Calendar.objects.filter(
        scenario_id=scenario_id,
        start_date__lte=date_obj,
        end_date__gte=date_obj,
    ).values("service_id", day_field)
    base = {r["service_id"] for r in base_qs if int(r[day_field] or 0) == 1}

    overrides = CalendarDates.objects.filter(
        scenario_id=scenario_id, date=date_obj
    ).values_list("service_id", "exception_type")
    add = {sid for sid, et in overrides if int(et) == 1}
    remove = {sid for sid, et in overrides if int(et) == 2}
    return (base | add) - remove


def build_all_routes_geojson(request):
    """
    Build route/stops GeoJSON payload based on query parameters.

    Parameters:
    - request (Request): DRF request.

    Returns:
    - dict: GeoJSON FeatureCollection.
    """
    scenario_id = request.query_params.get("scenario_id")
    if not scenario_id:
        raise KeyError(Messages.SCENARIO_ID_REQUIRED_DOT_EN)

    is_using_shape_data = _parse_bool(request.query_params.get("is_using_shape_data"), False)
    is_using_parent_stop = _parse_bool(request.query_params.get("is_using_parent_stop"), False)

    date_obj = _parse_date(request.query_params.get("date"))
    start_t = _parse_time(request.query_params.get("start_time"))
    end_t = _parse_time(request.query_params.get("end_time"))
    route_group_ids = _parse_csv(request.query_params.get("route_group_ids"))
    direction_ids_raw = _parse_csv(request.query_params.get("direction_id"))
    service_ids = _parse_csv(request.query_params.get("service_id"))

    direction_ids: List[int] = []
    for v in direction_ids_raw:
        try:
            direction_ids.append(int(v))
        except ValueError:
            pass

    try:
        scenario_obj = Scenario.objects.only("id", "stops_grouping_method").get(id=scenario_id)
    except Scenario.DoesNotExist:
        raise LookupError(Messages.SCENARIO_NOT_FOUND_TEMPLATE_EN.format(scenario_id=scenario_id))

    trip_qs = Trips.objects.filter(scenario_id=scenario_id)

    if route_group_ids:
        mapped_routes = set(
            RouteKeywordMap.objects.filter(
                scenario_id=scenario_id, keyword__id__in=route_group_ids
            ).values_list("route_id", flat=True)
        )
        trip_qs = trip_qs.filter(route_id__in=mapped_routes) if mapped_routes else trip_qs.none()

    if direction_ids:
        trip_qs = trip_qs.filter(direction_id__in=direction_ids)

    if service_ids:
        trip_qs = trip_qs.filter(service_id__in=service_ids)

    if date_obj:
        active_services = _active_services_on_date(scenario_id, date_obj)
        trip_qs = trip_qs.filter(service_id__in=active_services) if active_services else trip_qs.none()

    if start_t or end_t:
        st_q = StopTimes.objects.filter(
            scenario_id=scenario_id,
            trip_id__in=trip_qs.values_list("trip_id", flat=True),
        )
        if start_t and end_t:
            st_q = st_q.filter(
                Q(arrival_time__range=(start_t, end_t)) |
                Q(departure_time__range=(start_t, end_t))
            )
        elif start_t:
            st_q = st_q.filter(Q(arrival_time__gte=start_t) | Q(departure_time__gte=start_t))
        elif end_t:
            st_q = st_q.filter(Q(arrival_time__lte=end_t) | Q(departure_time__lte=end_t))

        allowed_trip_ids = set(st_q.values_list("trip_id", flat=True).distinct())
        trip_qs = trip_qs.filter(trip_id__in=allowed_trip_ids) if allowed_trip_ids else trip_qs.none()

    route_ids_from_trips = set(trip_qs.values_list("route_id", flat=True).distinct())
    existing_route_ids = set(
        Routes.objects.filter(scenario_id=scenario_id, route_id__in=route_ids_from_trips)
        .values_list("route_id", flat=True)
    )
    valid_route_ids = route_ids_from_trips & existing_route_ids

    features: List[dict] = []

    if not is_using_shape_data:
        if valid_route_ids:
            routes_qs = Routes.objects.filter(
                scenario_id=scenario_id, route_id__in=valid_route_ids
            ).values_list("route_id", "route_short_name", "route_type")

            for route_id, route_short_name, route_type in routes_qs:
                rep_trip = trip_qs.filter(route_id=route_id).first()
                if not rep_trip:
                    continue

                st_stop_ids = list(
                    StopTimes.objects.filter(
                        scenario_id=scenario_id, trip_id=rep_trip.trip_id
                    ).order_by("stop_sequence").values_list("stop_id", flat=True)
                )
                if not st_stop_ids:
                    continue

                stops_lookup = {
                    s.stop_id: (float(s.stop_lon), float(s.stop_lat))
                    for s in Stops.objects.filter(
                        scenario_id=scenario_id, stop_id__in=st_stop_ids
                    ).only("stop_id", "stop_lon", "stop_lat")
                }
                coords = [
                    [stops_lookup[sid][0], stops_lookup[sid][1]]
                    for sid in st_stop_ids if sid in stops_lookup
                ]
                if not coords:
                    continue

                features.append({
                    "type": "Feature",
                    "properties": {
                        "route_id": route_id,
                        "route_name": route_short_name,
                        "route_type": route_type,
                        "feature_type": "route",
                    },
                    "geometry": {"type": "LineString", "coordinates": coords},
                })
    else:
        if valid_route_ids:
            trips_with_shape = trip_qs.exclude(shape_id="").values("shape_id", "route_id")
            shape_to_route_ids: defaultdict[str, Set[str]] = defaultdict(set)
            shape_ids: Set[str] = set()
            for row in trips_with_shape:
                rid = row["route_id"]
                sid = row["shape_id"]
                if rid in existing_route_ids and sid:
                    shape_ids.add(sid)
                    shape_to_route_ids[sid].add(rid)

            if shape_ids:
                pts = Shape.objects.filter(
                    scenario_id=scenario_id, shape_id__in=shape_ids
                ).values_list("shape_id", "shape_pt_sequence", "shape_pt_lon", "shape_pt_lat")

                grouped: defaultdict[str, List[Tuple[int, float, float]]] = defaultdict(list)
                for sid, seq, lon, lat in pts:
                    grouped[sid].append((int(seq), float(lon), float(lat)))

                for sid, arr in grouped.items():
                    arr.sort(key=lambda x: x[0])
                    coords = [[lon, lat] for _, lon, lat in arr]
                    route_ids = sorted(shape_to_route_ids.get(sid, []))
                    if not route_ids:
                        continue

                    kw_rows = RouteKeywordMap.objects.filter(
                        scenario_id=scenario_id, route_id__in=route_ids
                    ).select_related("keyword").values(
                        "route_id", "keyword__keyword", "keyword__keyword_color"
                    )

                    kws = {r: None for r in route_ids}
                    cols = {r: None for r in route_ids}
                    for row in kw_rows:
                        r = row["route_id"]
                        if r in kws and kws[r] is None:
                            kws[r] = row["keyword__keyword"]
                            cols[r] = row["keyword__keyword_color"]

                    features.append({
                        "type": "Feature",
                        "properties": {
                            "feature_type": "route",
                            "shape_id": sid,
                            "route_ids": route_ids,
                            "keywords": [kws[r] for r in route_ids],
                            "keyword_colors": [cols[r] for r in route_ids],
                        },
                        "geometry": {"type": "LineString", "coordinates": coords},
                    })

    used_stop_ids: Set[str] = set()
    if trip_qs.exists():
        used_stop_ids = set(
            StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id__in=trip_qs.values_list("trip_id", flat=True),
            ).values_list("stop_id", flat=True).distinct()
        )

    stop_grouping_method_value = None

    if is_using_parent_stop:
        stop_grouping_method_value = scenario_obj.stops_grouping_method

        if stop_grouping_method_value == StopGroupingMethod.STOP_ID:
            maps_qs = list(
                StopIdKeywordMap.objects.filter(
                    scenario_id=scenario_id,
                    stop_id__in=used_stop_ids if used_stop_ids else [],
                )
                .order_by("id")
                .values("stop_id_group_id", "stop_id")
            )
            if maps_qs:
                ordered_group_ids: List[int] = []
                seen_group_ids: Set[int] = set()
                for m in maps_qs:
                    gid = m["stop_id_group_id"]
                    if gid not in seen_group_ids:
                        seen_group_ids.add(gid)
                        ordered_group_ids.append(gid)

                group_meta = {
                    g.stop_group_id: g
                    for g in StopIdKeyword.objects.filter(
                        scenario_id=scenario_id, stop_group_id__in=seen_group_ids
                    ).only("stop_group_id", "stop_id_keyword", "stop_id_long", "stop_id_lat")
                }
                for gid in ordered_group_ids:
                    gm = group_meta.get(gid)
                    if not gm:
                        continue
                    lon, lat = float(gm.stop_id_long), float(gm.stop_id_lat)
                    features.append({
                        "type": "Feature",
                        "properties": {
                            "feature_type": "parent_stop",
                            "stop_grouping_method": "stop_id",
                            "stop_group_id": int(gid),
                            "parent_stop_id": str(gid),
                            "parent_stop_name": gm.stop_id_keyword or str(gid),
                            "parent_stop": gm.stop_id_keyword or str(gid),
                        },
                        "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    })

        elif stop_grouping_method_value == StopGroupingMethod.STOP_NAME:
            name_maps = list(
                StopNameKeywordMap.objects.filter(
                    scenario_id=scenario_id,
                    stop_id__in=used_stop_ids if used_stop_ids else [],
                )
                .order_by("id")
                .values("stop_name_group_id", "stop_id")
            )
            if name_maps:
                ordered_group_ids: List[int] = []
                seen_group_ids: Set[int] = set()
                for m in name_maps:
                    gid = int(m["stop_name_group_id"])
                    if gid not in seen_group_ids:
                        seen_group_ids.add(gid)
                        ordered_group_ids.append(gid)

                group_meta = {
                    int(k.stop_group_id): k
                    for k in StopNameKeywords.objects.filter(
                        scenario_id=scenario_id, stop_group_id__in=seen_group_ids
                    ).only("stop_group_id", "stop_name_keyword", "stop_names_long", "stop_names_lat")
                }
                for gid in ordered_group_ids:
                    gm = group_meta.get(int(gid))
                    if not gm:
                        continue
                    lon, lat = float(gm.stop_names_long), float(gm.stop_names_lat)
                    features.append({
                        "type": "Feature",
                        "properties": {
                            "feature_type": "parent_stop",
                            "stop_grouping_method": "stop_name",
                            "stop_group_id": int(gid),
                            "parent_stop_id": str(gid),
                            "parent_stop_name": gm.stop_name_keyword or "",
                            "parent_stop": gm.stop_name_keyword or "",
                        },
                        "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    })
    else:
        if used_stop_ids:
            for stop in Stops.objects.filter(
                scenario_id=scenario_id, stop_id__in=used_stop_ids
            ).order_by("id").only("stop_id", "stop_name", "stop_lon", "stop_lat"):
                features.append({
                    "type": "Feature",
                    "properties": {
                        "feature_type": "stop",
                        "stop_id": stop.stop_id,
                        "stop_name": stop.stop_name,
                    },
                    "geometry": {"type": "Point", "coordinates": [float(stop.stop_lon), float(stop.stop_lat)]},
                })

    rk_rows = RouteKeywords.objects.filter(scenario_id=scenario_id).values("id", "keyword", "keyword_color")
    route_groups = [
        {
            "route_group_id": str(row["id"]),
            "route_group_name": row["keyword"],
            "color": normalize_hex(row["keyword_color"]),
        }
        for row in rk_rows
    ]

    return {
        "type": "FeatureCollection",
        "features": features,
        "stop_grouping_method": stop_grouping_method_value if is_using_parent_stop else None,
        "route_groups": route_groups,
    }


def get_stops_on_buffer_area_multi_polygon(geojson):
    """
    Build grouped stops JSON for stops within buffer polygon/multipolygon.

    Parameters:
    - geojson (dict): Buffer analysis GeoJSON.

    Returns:
    - dict: Grouped stops payload.
    """
    scenario_id = geojson.get("properties", {}).get("scenario_id")
    multi_polygon_features = [f for f in geojson.get("features", []) if f.get("geometry", {}).get("type") == "MultiPolygon"]
    polygon_features = [f for f in geojson.get("features", []) if f.get("geometry", {}).get("type") == "Polygon"]
    stops = get_stops_in_multi_polygon(scenario_id, multi_polygon_features, polygon_features)
    return build_grouped_stops_json(scenario_id, stops)


def get_route_and_stops_on_buffer_area(geojson):
    """
    Build route group structure for trips within buffer area.

    Parameters:
    - geojson (dict): Buffer analysis GeoJSON.

    Returns:
    - list[dict]: Route group structure.
    """
    scenario_id = geojson.get("properties", {}).get("scenario_id")
    trip_polyline_features = [f for f in geojson.get("features", []) if f.get("properties", {}).get("type") == "trip_polyline"]
    return build_route_group_structure(trip_polyline_features, scenario_id)


def build_route_group_structure(trip_polyline_features, scenario_id):
    """
    Build route groups with stops from trip polyline features.

    Parameters:
    - trip_polyline_features (list[dict]): Trip polyline features.
    - scenario_id (str): Scenario identifier.

    Returns:
    - list[dict]: Route groups with routes and stops.
    """
    trip_ids = [f["properties"]["trip_id"] for f in trip_polyline_features]
    trips = Trips.objects.filter(trip_id__in=trip_ids, scenario_id=scenario_id)
    trip_to_route = {t.trip_id: t.route_id for t in trips}
    route_ids = list(set(trip_to_route.values()))
    routes = Routes.objects.filter(route_id__in=route_ids, scenario_id=scenario_id)
    route_id_to_name = {r.route_id: (r.route_short_name or r.route_long_name or r.route_id) for r in routes}
    route_keyword_maps = RouteKeywordMap.objects.filter(route_id__in=route_ids, scenario_id=scenario_id).select_related("keyword")
    group_dict = {}
    for rkm in route_keyword_maps:
        if rkm.keyword.keyword not in group_dict:
            group_dict[rkm.keyword.keyword] = []
        group_dict[rkm.keyword.keyword].append(rkm.route_id)
    result = []
    for group_name, group_route_ids in group_dict.items():
        group_routes = []
        for route_id in group_route_ids:
            for feature in trip_polyline_features:
                if trip_to_route.get(feature["properties"]["trip_id"]) == route_id:
                    seen = set()
                    stops = []
                    for st in feature["properties"]["stoptimes"]:
                        if (st["stop_id"], st["stop_name"]) not in seen:
                            seen.add((st["stop_id"], st["stop_name"]))
                            stops.append({"stop_id": st["stop_id"], "stop_name": st["stop_name"]})
                    group_routes.append({
                        "route_id": route_id,
                        "route_name": route_id_to_name.get(route_id, route_id),
                        "stops": stops,
                    })
        result.append({"route_group_name": group_name, "routes": group_routes})
    return result


def get_stops_in_multi_polygon(scenario_id, multi_polygon_feature, polygon_feature):
    """
    Find stops within the provided polygon(s).

    Parameters:
    - scenario_id (str): Scenario identifier.
    - multi_polygon_feature (list[dict]|None): Multipolygon features.
    - polygon_feature (list[dict]|None): Polygon features.

    Returns:
    - list[dict]: Stops within polygons.
    """
    all_stops = []
    stops = Stops.objects.filter(scenario_id=scenario_id)
    if multi_polygon_feature:
        for polygon_coords in multi_polygon_feature[0]["geometry"]["coordinates"]:
            polygon = Polygon(polygon_coords[0])
            for stop in stops:
                if polygon.contains(Point(stop.stop_lon, stop.stop_lat)):
                    all_stops.append({
                        "stop_id": stop.stop_id,
                        "stop_name": stop.stop_name,
                        "stop_lat": stop.stop_lat,
                        "stop_lon": stop.stop_lon,
                    })
    if polygon_feature:
        polygon = Polygon(polygon_feature[0]["geometry"]["coordinates"][0])
        for stop in stops:
            if polygon.contains(Point(stop.stop_lon, stop.stop_lat)):
                all_stops.append({
                    "stop_id": stop.stop_id,
                    "stop_name": stop.stop_name,
                    "stop_lat": stop.stop_lat,
                    "stop_lon": stop.stop_lon,
                })
    return all_stops


def build_grouped_stops_json(scenario_id, result_stops):
    """
    Group stops by scenario stop grouping method.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - result_stops (list[dict]): Stops within polygon.

    Returns:
    - dict: Grouped stops payload.
    """
    scenario = Scenario.objects.get(id=scenario_id)
    stops_ids = [stop["stop_id"] for stop in result_stops]
    if scenario.stops_grouping_method == StopGroupingMethod.STOP_NAME:
        maps = StopNameKeywordMap.objects.filter(stop_id__in=stops_ids, scenario_id=scenario_id)
        group_id_to_name = {
            k.stop_name_group_id: StopNameKeywords.objects.get(
                stop_group_id=k.stop_name_group_id, scenario_id=scenario_id
            ).stop_name_keyword
            for k in maps
        }
        group_dict = {}
        for m in maps:
            parent_name = group_id_to_name[m.stop_name_group_id]
            if parent_name not in group_dict:
                group_dict[parent_name] = []
            stop = next((s for s in result_stops if s["stop_id"] == m.stop_id), None)
            if stop:
                group_dict[parent_name].append({
                    "stop_name": stop["stop_name"],
                    "stop_id": stop["stop_id"],
                    "child_data": stop["stop_name"],
                })
    else:
        maps = StopIdKeywordMap.objects.filter(stop_id__in=stops_ids, scenario_id=scenario_id)
        group_id_to_name = {
            k.stop_id_group_id: StopIdKeyword.objects.get(
                stop_group_id=k.stop_id_group_id, scenario_id=scenario_id
            ).stop_id_keyword
            for k in maps
        }
        group_dict = {}
        for m in maps:
            parent_name = group_id_to_name[m.stop_id_group_id]
            if parent_name not in group_dict:
                group_dict[parent_name] = []
            stop = next((s for s in result_stops if s["stop_id"] == m.stop_id), None)
            if stop:
                group_dict[parent_name].append({
                    "stop_name": stop["stop_name"],
                    "stop_id": stop["stop_id"],
                    "child_data": stop["stop_id"],
                })
    return {
        "grouping_method": scenario.stops_grouping_method,
        "stops": [{"parent_data": p, "childs": c} for p, c in group_dict.items()],
    }
