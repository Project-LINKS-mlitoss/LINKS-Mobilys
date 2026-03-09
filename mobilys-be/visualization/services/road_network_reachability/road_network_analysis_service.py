# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import json
from datetime import datetime, timedelta

from django.contrib.gis.geos import Point, GEOSGeometry
from gtfs.models import Routes, Stops, StopTimes, Trips
from visualization.models import PopulationMesh
from visualization.utils.road_network_reachability_utils import (
    get_valid_service_ids_for_date,
    group_routes_by_keyword,
    group_stops_by_scenario_method,
)


def get_routes_and_stops_within_isochrone(scenario_id, isochrone_geojson, date_str, start_time_str):
    departure_datetime = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")

    # Prepare date and valid service IDs
    base_date = departure_datetime.date()
    valid_service_ids = get_valid_service_ids_for_date(base_date)

    # Sort isochrone features by cutoff time
    features = sorted(
        isochrone_geojson.get("features", []),
        key=lambda f: f["properties"].get("time", 0),
    )

    # Build stop lookup
    stops = Stops.objects.filter(scenario_id=scenario_id).only(
        "stop_id", "stop_name", "stop_lat", "stop_lon"
    )

    stop_lookup = {}
    for s in stops:
        try:
            lat = float(s.stop_lat)
            lon = float(s.stop_lon)
        except (TypeError, ValueError):
            continue
        stop_lookup[s.stop_id] = {
            "stop_id": s.stop_id,
            "stop_name": s.stop_name,
            "lat": lat,
            "lon": lon,
        }

    results = []
    results_stop_group = []

    for feature in features:
        geom_data = feature.get("geometry")
        if not geom_data:
            # Skip features without geometry (e.g., no coverage for that cutoff)
            continue
        cutoff_time = feature["properties"].get("time")
        geom = GEOSGeometry(json.dumps(geom_data), srid=4326)

        if not geom.valid:
            geom = geom.buffer(0)
        if geom.srid != 4326:
            geom.srid = 4326

        # Calculate cutoff time window
        start_time_obj = departure_datetime.time()
        end_time_obj = (departure_datetime + timedelta(seconds=cutoff_time)).time()

        # Find reachable stops
        reachable_stops, stop_ids = [], []
        for stop_id, stop in stop_lookup.items():
            point = Point(stop["lon"], stop["lat"], srid=4326)
            contained = (
                any(point.within(poly) for poly in geom)
                if geom.geom_type == "MultiPolygon"
                else point.within(geom)
            )
            if contained:
                reachable_stops.append(stop)
                stop_ids.append(stop_id)

        stops_grouped = group_stops_by_scenario_method(scenario_id, reachable_stops)
        results_stop_group.append({
            "cutoff_time": cutoff_time,
            "stop_groups": stops_grouped,
        })

        if not stop_ids:
            results.append({"cutoff_time": cutoff_time, "routes_data": []})
            continue

        # Get valid trips for date (plain field filtering)
        valid_trip_ids = set(
            Trips.objects.filter(service_id__in=valid_service_ids)
            .values_list("trip_id", flat=True)
        )

        # Filter StopTimes by stop_ids, trip_ids, and time window
        trip_stop_times = StopTimes.objects.filter(
            stop_id__in=stop_ids,
            trip_id__in=valid_trip_ids,
            departure_time__gte=start_time_obj,
            departure_time__lte=end_time_obj,
        ).values("trip_id", "stop_id", "stop_sequence").distinct()

        trip_ids = {t["trip_id"] for t in trip_stop_times}
        if not trip_ids:
            results.append({"cutoff_time": cutoff_time, "routes_data": []})
            continue

        # Fetch route IDs for these trips
        trip_to_route = {
            t["trip_id"]: t["route_id"]
            for t in Trips.objects.filter(trip_id__in=trip_ids).values("trip_id", "route_id")
        }
        route_ids = set(trip_to_route.values())

        # Fetch routes
        routes_qs = Routes.objects.filter(route_id__in=route_ids).only(
            "route_id", "route_short_name", "route_long_name"
        ).distinct("route_id")

        # Build per-route stop sequences
        route_dict = {}
        for t in trip_stop_times:
            trip_id = t["trip_id"]
            route_id = trip_to_route.get(trip_id)
            stop_id = t["stop_id"]
            stop_seq = t["stop_sequence"]

            if not route_id:
                continue

            if route_id not in route_dict:
                route_dict[route_id] = {}

            stop_detail = stop_lookup.get(stop_id)
            if stop_detail and stop_id not in route_dict[route_id]:
                route_dict[route_id][stop_id] = {
                    **stop_detail,
                    "stop_sequence": stop_seq,
                }

        # Final route list with grouped stops
        route_list = []
        for route in routes_qs:
            stops_for_route = list(route_dict.get(route.route_id, {}).values())
            stops_sorted = sorted(stops_for_route, key=lambda x: x["stop_sequence"])
            grouped_stops = group_stops_by_scenario_method(scenario_id, stops_sorted)
            route_list.append({
                "route_id": route.route_id,
                "route_short_name": route.route_short_name,
                "route_long_name": route.route_long_name,
                "stops": grouped_stops,
            })

        grouped_routes = group_routes_by_keyword(route_list, scenario_id)
        results.append({
            "cutoff_time": cutoff_time,
            "routes_data": grouped_routes,
        })

    return results, results_stop_group


def get_stop_groups_within_isochrone(scenario_id, isochrone_geojson):
    features = sorted(
        isochrone_geojson.get("features", []),
        key=lambda f: f["properties"].get("time", 0),
    )

    stops = Stops.objects.filter(scenario_id=scenario_id).only(
        "stop_id", "stop_name", "stop_lat", "stop_lon"
    )

    stop_lookup = {}
    for s in stops:
        try:
            lat = float(s.stop_lat)
            lon = float(s.stop_lon)
        except (TypeError, ValueError):
            continue
        stop_lookup[s.stop_id] = {
            "stop_id": s.stop_id,
            "stop_name": s.stop_name,
            "lat": lat,
            "lon": lon,
        }

    results_stop_group = []

    for feature in features:
        geom_data = feature.get("geometry")
        if not geom_data:
            continue
        cutoff_time = feature["properties"].get("time")
        geom = GEOSGeometry(json.dumps(geom_data), srid=4326)

        if not geom.valid:
            geom = geom.buffer(0)
        if geom.srid != 4326:
            geom.srid = 4326

        reachable_stops = []
        for stop_id, stop in stop_lookup.items():
            point = Point(stop["lon"], stop["lat"], srid=4326)
            contained = (
                any(point.within(poly) for poly in geom)
                if geom.geom_type == "MultiPolygon"
                else point.within(geom)
            )
            if contained:
                reachable_stops.append(stop)

        stops_grouped = group_stops_by_scenario_method(scenario_id, reachable_stops)
        results_stop_group.append({
            "cutoff_time": cutoff_time,
            "stop_groups": stops_grouped,
        })

    return results_stop_group


def get_population_within_isochrone(isochrone_geojson):
    features = sorted(
        isochrone_geojson.get("features", []),
        key=lambda f: f["properties"].get("time", 0),
    )
    results = []

    for feature in features:
        geom_data = feature.get("geometry")
        if not geom_data:
            # Skip features without geometry (e.g., no coverage for that cutoff)
            continue
        cutoff_time = feature["properties"].get("time")
        geom_json = json.dumps(geom_data)
        geom = GEOSGeometry(geom_json, srid=4326)

        if not geom.valid:
            geom = geom.buffer(0)

        if geom.srid != 4326:
            geom.srid = 4326

        population_meshes = PopulationMesh.objects.filter(
            geom__intersects=geom
        )

        total_area = 0
        age_0_14_sum = 0
        age_15_64_sum = 0
        age_65_up_sum = 0
        total_population_sum = 0

        meshes_data = []
        full_inside_count = 0
        partial_count = 0

        for pm in population_meshes:
            if geom.contains(pm.geom):
                # Fully inside: full population
                age_0_14 = pm.age_0_14
                age_15_64 = pm.age_15_64
                age_65_up = pm.age_65_up
                total = pm.total
                area_in = pm.geom.area
                full_inside_count += 1
            else:
                # Partially inside: proportional population
                intersection = pm.geom.intersection(geom)
                if intersection.empty:
                    continue

                area_in = intersection.area
                mesh_area = pm.geom.area
                ratio = area_in / mesh_area

                age_0_14 = pm.age_0_14 * ratio
                age_15_64 = pm.age_15_64 * ratio
                age_65_up = pm.age_65_up * ratio
                total = pm.total * ratio
                partial_count += 1

            age_0_14_sum += age_0_14
            age_15_64_sum += age_15_64
            age_65_up_sum += age_65_up
            total_population_sum += total
            total_area += area_in

            meshes_data.append({
                "meshcode": pm.meshcode,
                "mcode": pm.mcode,
                "age_0_14": round(age_0_14),
                "age_15_64": round(age_15_64),
                "age_65_up": round(age_65_up),
                "total": round(total),
                "is_full_inside": geom.contains(pm.geom),
            })

        results.append({
            "cutoff_time": cutoff_time,
            "area_deg2": total_area,  # area in degrees^2
            "area_km2_estimate": total_area * (111 ** 2),  # approximate km^2
            "age_0_14": round(age_0_14_sum),
            "age_15_64": round(age_15_64_sum),
            "age_65_up": round(age_65_up_sum),
            "total_population": round(total_population_sum),
            "full_inside_meshes": full_inside_count,
            "partial_meshes": partial_count,
            "meshes": meshes_data,
        })

    return results
