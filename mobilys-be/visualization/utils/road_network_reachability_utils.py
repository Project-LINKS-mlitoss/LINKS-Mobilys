# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import environ
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point as ShapelyPoint

from django.contrib.gis.geos import Point as GeoPoint
from gtfs.models import (
    Calendar,
    CalendarDates,
    RouteKeywordMap,
    RouteKeywords,
    Scenario,
    StopIdKeyword,
    StopIdKeywordMap,
    StopNameKeywords,
    StopNameKeywordMap,
    Stops,
)
from visualization.services.base import ServiceError
from visualization.constants.values import ALLOWED_GRAPH_TYPES, DEFAULT_GRAPH_TYPE
from visualization.constants.messages import Messages

env = environ.Env()


def get_valid_service_ids_for_date(date):
    services = set(Calendar.objects.filter(
        start_date__lte=date,
        end_date__gte=date,
        **{date.strftime("%A").lower(): True},
    ).values_list("service_id", flat=True))

    added = CalendarDates.objects.filter(date=date, exception_type=1).values_list("service_id", flat=True)
    removed = CalendarDates.objects.filter(date=date, exception_type=2).values_list("service_id", flat=True)

    services.update(added)
    services.difference_update(removed)
    return services


def group_stops_by_scenario_method(scenario_id, stops):
    try:
        scenario = Scenario.objects.get(id=scenario_id)
    except Scenario.DoesNotExist as exc:
        raise ServiceError(Messages.SCENARIO_NOT_FOUND_EN, status_code=404) from exc
    grouping_method = scenario.stops_grouping_method

    grouped = {}

    if grouping_method == "stop_name":
        maps_qs = StopNameKeywordMap.objects.filter(scenario_id=scenario_id)
        stop_to_groupid = {m.stop_id: m.stop_name_group_id for m in maps_qs}

        group_qs = StopNameKeywords.objects.filter(scenario_id=scenario_id)
        groupid_to_keyword = {g.stop_group_id: g.stop_name_keyword for g in group_qs}
    else:
        maps_qs = StopIdKeywordMap.objects.filter(scenario_id=scenario_id)
        stop_to_groupid = {m.stop_id: m.stop_id_group_id for m in maps_qs}

        group_qs = StopIdKeyword.objects.filter(scenario_id=scenario_id)
        groupid_to_keyword = {g.stop_group_id: g.stop_id_keyword for g in group_qs}

    for stop in stops:
        stop_id = stop["stop_id"]
        group_id = int(stop_to_groupid.get(stop_id))
        keyword = groupid_to_keyword.get(group_id, "Unknown Group")

        if keyword not in grouped:
            grouped[keyword] = []
        grouped[keyword].append(stop)

    result = []
    for keyword, stops_list in grouped.items():
        result.append({
            "stops_group": keyword,
            "stops": stops_list,
        })

    return result


def get_route_keywords_for_routes(route_ids, scenario_id):
    keyword_qs = RouteKeywordMap.objects.filter(
        scenario_id=scenario_id,
        route_id__in=route_ids,
    ).select_related("keyword")

    route_keyword_map = {}
    for k in keyword_qs:
        route_keyword_map[k.route_id] = {
            "keyword": k.keyword.keyword,
        }

    return route_keyword_map


def group_routes_by_keyword(route_list, scenario_id):
    route_ids = [route["route_id"] for route in route_list]
    route_keywords = get_route_keywords_for_routes(route_ids, scenario_id)

    grouped = {}
    for route in route_list:
        r_id = route["route_id"]
        keyword_info = route_keywords.get(r_id, {"keyword": None})
        keyword = keyword_info["keyword"]

        if keyword not in grouped:
            grouped[keyword] = []
        grouped[keyword].append(route)

    grouped_list = []
    for keyword, routes in grouped.items():
        grouped_list.append({
            "route_group": keyword,
            "routes": routes,
        })

    return grouped_list


def get_region_by_LatLon(lat, lon):
    gdf = gpd.read_file("data/regions_geojson/japan_regions.geojson")

    point = gpd.GeoDataFrame(
        [{"geometry": ShapelyPoint(lon, lat)}],
        crs="EPSG:4326",
    )

    joined = gpd.sjoin(point, gdf, how="left", predicate="within")
    region = joined.iloc[0]["name"]
    return region


def get_prefecture_by_LatLon(lat, lon):
    gdf = gpd.read_file("data/prefectures_geojson/japan_prefectures.geojson")

    point = gpd.GeoDataFrame(
        [{"geometry": ShapelyPoint(lon, lat)}],
        crs="EPSG:4326",
    )

    joined = gpd.sjoin(point, gdf, how="left", predicate="within")
    prefecture = joined.iloc[0]["NAME_1"]
    return prefecture


def get_region_and_prefecture_by_center_point(center_lat, center_lon):
    return {
        "region": get_region_by_LatLon(center_lat, center_lon),
        "prefecture": get_prefecture_by_LatLon(center_lat, center_lon),
    }


def get_region_and_prefecture_by_center_point_scenario(scenario_id):
    stops = Stops.objects.filter(scenario_id=scenario_id).only("stop_lat", "stop_lon")
    if not stops.exists():
        return None
    center_lat = sum(stop.stop_lat for stop in stops) / stops.count()
    center_lon = sum(stop.stop_lon for stop in stops) / stops.count()

    return get_region_and_prefecture_by_center_point(center_lat, center_lon)


def get_region_and_prefectures_by_scenario(scenario_id):
    stops = Stops.objects.filter(scenario_id=scenario_id).only("stop_lat", "stop_lon")
    if not stops.exists():
        return None

    lats = [stop.stop_lat for stop in stops]
    lons = [stop.stop_lon for stop in stops]

    points = [
        (min(lats), min(lons)),  # SW
        (min(lats), max(lons)),  # SE
        (max(lats), min(lons)),  # NW
        (max(lats), max(lons)),  # NE
    ]

    prefectures = set()
    for lat, lon in points:
        prefecture = get_prefecture_by_LatLon(lat, lon)
        if prefecture and not pd.isna(prefecture) and prefecture not in prefectures:
            prefectures.add(prefecture)

    center_lat = sum(lats) / len(lats)
    center_lon = sum(lons) / len(lons)

    return {
        "region": get_region_by_LatLon(center_lat, center_lon),
        "prefectures": list(prefectures),
    }


def _normalize_graph_type(graph_type: str | None) -> str:
    gt = (graph_type or DEFAULT_GRAPH_TYPE).lower()
    return gt if gt in ALLOWED_GRAPH_TYPES else DEFAULT_GRAPH_TYPE


def _status_field(graph_type: str) -> str:
    return "osm_graph_status" if graph_type == "osm" else "drm_graph_status"
