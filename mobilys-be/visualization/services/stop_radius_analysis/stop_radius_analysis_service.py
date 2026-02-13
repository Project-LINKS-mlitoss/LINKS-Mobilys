# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import json
from collections import defaultdict

from django.contrib.gis.geos import GEOSGeometry
from django.db import connections
from gtfs.models import (
    RouteKeywordMap,
    RouteKeywords,
    Routes,
    Scenario,
    StopIdKeywordMap,
    Stops,
    StopTimes,
    Trips,
)
from visualization.models import PopulationMesh
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages
from visualization.services.stop_radius_analysis.stop_radius_poi_service import (
    get_pois_for_stop_buffer_combined,
    summarize_pois_for_union,
)
from visualization.constants.messages import Messages



def get_stop_buffers(radius, scenario_id, dissolve="none", outline_only=True):
    """
    Build stop buffer geometries for a scenario.

    Parameters:
    - radius (float): Buffer radius in meters.
    - scenario_id (str|int): Scenario identifier.
    - dissolve (str): "none", "group", or "global".
    - outline_only (bool): If True, return outlines only.

    Returns:
    - dict: GeoJSON FeatureCollection of stop buffers.
    """
    try:
        scenario = Scenario.objects.get(id=scenario_id)
    except Scenario.DoesNotExist:
        raise ServiceError(Messages.SCENARIO_NOT_FOUND_EN, status_code=404)

    db_alias = getattr(scenario._state, "db", None) or "default"
    conn = connections[db_alias]
    qn = conn.ops.quote_name

    stop_tbl = qn(Stops._meta.db_table)
    map_tbl  = qn(StopIdKeywordMap._meta.db_table)
    method = (scenario.stops_grouping_method or "stop_name").strip()

    # buffer per stop (meter-accurate)
    buf_expr = """
        ST_Buffer(
            ST_SetSRID(ST_MakePoint(s.stop_lon, s.stop_lat), 4326)::geography,
            %s
        )::geometry
    """

    def wrap_geom(expr: str) -> str:
        return f"ST_Boundary({expr})" if outline_only else expr

    if dissolve == "global":
        sql = f"""
            SELECT
                'ALL' AS group_id,
                ST_AsGeoJSON(
                    {wrap_geom(f"ST_UnaryUnion(ST_Collect({buf_expr}))")}
                ) AS geom
            FROM {stop_tbl} s
            WHERE s.scenario_id = %s
              AND s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
        """
        params = [radius, str(scenario_id)]

    elif dissolve == "group":
        # union per group (stop_id_group_id / stop_name)
        if method == "stop_id":
            sql = f"""
                SELECT
                    m.stop_id_group_id::text AS group_id,
                    ST_AsGeoJSON(
                        {wrap_geom(f"ST_UnaryUnion(ST_Collect({buf_expr}))")}
                    ) AS geom
                FROM {map_tbl} m
                JOIN {stop_tbl} s
                  ON s.stop_id = m.stop_id AND s.scenario_id = m.scenario_id
                WHERE s.scenario_id = %s
                  AND s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
                GROUP BY m.stop_id_group_id
            """
            params = [radius, str(scenario_id)]
        else:
            sql = f"""
                SELECT
                    s.stop_name AS group_id,
                    ST_AsGeoJSON(
                        {wrap_geom(f"ST_UnaryUnion(ST_Collect({buf_expr}))")}
                    ) AS geom
                FROM {stop_tbl} s
                WHERE s.scenario_id = %s
                  AND s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
                GROUP BY s.stop_name
            """
            params = [radius, str(scenario_id)]

    else:
        if method == "stop_id":
            sql = f"""
                SELECT
                    m.stop_id_group_id::text AS group_id,
                    ST_AsGeoJSON(
                        {wrap_geom("""
                            ST_Buffer(
                              ST_SetSRID(ST_MakePoint(AVG(s.stop_lon), AVG(s.stop_lat)), 4326)::geography,
                              %s
                            )::geometry
                        """)}
                    ) AS geom
                FROM {map_tbl} m
                JOIN {stop_tbl} s
                  ON s.stop_id = m.stop_id AND s.scenario_id = m.scenario_id
                WHERE s.scenario_id = %s
                  AND s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
                GROUP BY m.stop_id_group_id
            """
            params = [radius, str(scenario_id)]
        else:
            sql = f"""
                SELECT
                    s.stop_name AS group_id,
                    ST_AsGeoJSON(
                        {wrap_geom("""
                            ST_Buffer(
                              ST_SetSRID(ST_MakePoint(AVG(s.stop_lon), AVG(s.stop_lat)), 4326)::geography,
                              %s
                            )::geometry
                        """)}
                    ) AS geom
                FROM {stop_tbl} s
                WHERE s.scenario_id = %s
                  AND s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
                GROUP BY s.stop_name
            """
            params = [radius, str(scenario_id)]

    features = []
    with conn.cursor() as cur:
        cur.execute(sql, params)
        for group_id, geom_json in cur.fetchall():
            features.append({
                "type": "Feature",
                "geometry": json.loads(geom_json),
                "properties": {
                    "stop_group_method": method,
                    "group_id": group_id,
                    "dissolve": dissolve,
                    "outline_only": bool(outline_only),
                }
            })

    return {"type": "FeatureCollection", "features": features}


def get_route_groups_for_stop_group(scenario_id):
    """
    Build route groups for each stop group in a scenario.

    Parameters:
    - scenario_id (str|int): Scenario identifier.

    Returns:
    - list[dict]: Route graph grouped by stop group.
    """
    try:
        scenario = Scenario.objects.get(id=scenario_id)
    except Scenario.DoesNotExist as exc:
        raise ServiceError(Messages.SCENARIO_NOT_FOUND_EN, status_code=404) from exc

    method = (scenario.stops_grouping_method or "stop_name").strip()

    stop_groups = defaultdict(set)
    if method == "stop_id":
        for group_id, stop_id in (
            StopIdKeywordMap.objects
            .filter(scenario=scenario)
            .values_list("stop_id_group_id", "stop_id")
            .iterator()
        ):
            stop_groups[str(group_id)].add(stop_id)
    else:
        for stop_id, stop_name in (
            Stops.objects
            .filter(scenario=scenario)
            .values_list("stop_id", "stop_name")
            .iterator()
        ):
            stop_groups[stop_name].add(stop_id)

    if not stop_groups:
        return {"stop_group_method": method, "route_graph": []}

    all_stop_ids = {sid for sids in stop_groups.values() for sid in sids}
    if not all_stop_ids:
        return {"stop_group_method": method, "route_graph": []}

    stop_to_trips = defaultdict(set)
    for stop_id, trip_id in (
        StopTimes.objects
        .filter(scenario=scenario, stop_id__in=all_stop_ids)
        .values_list("stop_id", "trip_id")
        .iterator()
    ):
        stop_to_trips[stop_id].add(trip_id)

    all_trip_ids = {tid for tids in stop_to_trips.values() for tid in tids}
    trip_to_route = {}
    if all_trip_ids:
        for trip_id, route_id in (
            Trips.objects
            .filter(scenario=scenario, trip_id__in=all_trip_ids)
            .values_list("trip_id", "route_id")
            .iterator()
        ):
            trip_to_route[trip_id] = route_id

    stop_to_routes = defaultdict(set)
    for sid, tids in stop_to_trips.items():
        for tid in tids:
            rid = trip_to_route.get(tid)
            if rid:
                stop_to_routes[sid].add(rid)

    all_route_ids = {rid for rids in stop_to_routes.values() for rid in rids}
    route_meta = {}
    if all_route_ids:
        for rid, short in (
            Routes.objects
            .filter(scenario=scenario, route_id__in=all_route_ids)
            .values_list("route_id", "route_short_name")
            .iterator()
        ):
            route_meta[rid] = {"route_id": rid, "route_short_name": short or ""}

    route_to_keywords = defaultdict(set)
    keyword_meta = {}
    if all_route_ids:
        for rid, kwid in (
            RouteKeywordMap.objects
            .filter(scenario=scenario, route_id__in=all_route_ids)
            .values_list("route_id", "keyword_id")
            .iterator()
        ):
            route_to_keywords[rid].add(kwid)

        all_kw_ids = {kw for kws in route_to_keywords.values() for kw in kws}
        if all_kw_ids:
            for kwid, kw_text, kw_color in (
                RouteKeywords.objects
                .filter(scenario=scenario, id__in=all_kw_ids)
                .values_list("id", "keyword", "keyword_color")
                .iterator()
            ):
                keyword_meta[kwid] = {"keyword": kw_text, "color": kw_color or ""}

    route_graph = []
    for group_id, member_stop_ids in stop_groups.items():
        routes_in_group = set()
        for sid in member_stop_ids:
            routes_in_group |= stop_to_routes.get(sid, set())

        bucket = defaultdict(list)
        for rid in routes_in_group:
            for kwid in route_to_keywords.get(rid, set()):
                kw = keyword_meta.get(kwid)
                if not kw:
                    continue
                bucket[kw["keyword"]].append(route_meta.get(rid, {"route_id": rid, "route_short_name": ""}))

        routes_payload = []
        for keyword_text in sorted(bucket.keys()):
            routes_payload.append({
                "route_group_id": keyword_text,
                "child": sorted(bucket[keyword_text], key=lambda r: (r.get("route_short_name") or "", r["route_id"])),
            })

        route_graph.append({
            "id": group_id,
            "routes": routes_payload,
        })
    return route_graph


def get_population_for_stop_buffer(stop_buffer):
    """
    Aggregate population inside each stop buffer polygon.

    Parameters:
    - stop_buffer (dict): GeoJSON FeatureCollection of stop buffers.

    Returns:
    - list[dict]: Population totals per stop group.
    """
    stop_buffer_features = stop_buffer["features"]
    results = []
    for feature in stop_buffer_features:
        stop_group_id = feature['properties'].get('group_id')

        geom_json = json.dumps(feature['geometry'])
        geom = GEOSGeometry(geom_json, srid=4326)

        if not geom.valid:
            geom = geom.buffer(0)

        if geom.srid != 4326:
            geom.srid = 4326

        # Fetch population meshes intersecting the isochrone
        population_meshes = PopulationMesh.objects.filter(
            geom__intersects=geom
        )

        total_area = 0
        age_0_14_sum = 0
        age_15_64_sum = 0
        age_65_up_sum = 0
        total_population_sum = 0

        for pm in population_meshes:
            if geom.contains(pm.geom):
                # Fully inside: full population
                age_0_14 = pm.age_0_14
                age_15_64 = pm.age_15_64
                age_65_up = pm.age_65_up
                total = pm.total
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

            # Accumulate totals
            age_0_14_sum += age_0_14
            age_15_64_sum += age_15_64
            age_65_up_sum += age_65_up
            total_population_sum += total

        results.append({
            "id": stop_group_id,
            "age_0_14": round(age_0_14_sum),
            "age_15_64": round(age_15_64_sum),
            "age_65_up": round(age_65_up_sum),
            "total_population": round(total_population_sum),
        })

    return results

def aggregate_population_rows(rows):
    """
    Sum population rows into one total.

    Parameters:
    - rows (list[dict]): Population rows.

    Returns:
    - dict: Total population by age group.
    """
    acc = {"age_0_14": 0.0, "age_15_64": 0.0, "age_65_up": 0.0, "total_population": 0.0}
    for r in rows or []:
        acc["age_0_14"]       += float(r.get("age_0_14", 0))
        acc["age_15_64"]      += float(r.get("age_15_64", 0))
        acc["age_65_up"]      += float(r.get("age_65_up", 0))
        acc["total_population"] += float(r.get("total_population", 0))
    return {k: int(round(v)) for k, v in acc.items()}

def summarize_pois_for_union(poi_graph):
    """
    Summarize POIs into counts and map-friendly points.

    Parameters:
    - poi_graph (list[dict]): POI graph grouped by stop group.

    Returns:
    - tuple: (poi_summary, poi_for_map).
    """
    bucket = defaultdict(list)
    for g in poi_graph or []:
        for cat in g.get("pois", []):
            t = cat.get("type") or "Unknown"
            for p in (cat.get("data") or []):
                bucket[t].append({
                    "type": t,
                    "poi_name": p.get("poi_name") or "",
                    "lat": float(p.get("lat")),
                    "lng": float(p.get("lng")),
                    "address": p.get("address") or "",
                })

    poi_summary = [{"type": t, "count": len(items)} for t, items in bucket.items()]
    poi_for_map = [pt for items in bucket.values() for pt in items]
    poi_summary.sort(key=lambda x: (-x["count"], x["type"]))
    return poi_summary, poi_for_map


def build_stop_group_buffer_payload(scenario_id: str, radius: float, dissolve: str, outline_only: bool) -> dict:
    """
    Build stop buffer FeatureCollection for a scenario.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - radius (float): Buffer radius in meters.
    - dissolve (str): "none", "group", or "global".
    - outline_only (bool): Whether to return outline geometries only.

    Returns:
    - dict: GeoJSON FeatureCollection.
    """
    return get_stop_buffers(radius, scenario_id, dissolve=dissolve, outline_only=outline_only)


def build_stop_group_graph_payload(scenario_id: str, radius: float, user, project_id=None) -> dict:
    """
    Build stop group graph payload for a scenario.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - radius (float): Buffer radius in meters.
    - user: Request user for POI filtering.
    - project_id: Optional project id.

    Returns:
    - dict: Graph payload.
    """
    try:
        scenario = Scenario.objects.get(id=scenario_id)
    except Scenario.DoesNotExist as exc:
        raise ServiceError(Messages.SCENARIO_NOT_FOUND_EN, status_code=404) from exc

    method = (scenario.stops_grouping_method or "stop_name").strip()

    fc_union = get_stop_buffers(radius, scenario_id, dissolve="global", outline_only=False)

    pop_rows = get_population_for_stop_buffer(fc_union)
    population_total = aggregate_population_rows(pop_rows)

    poi_graph = get_pois_for_stop_buffer_combined(
        fc_union, user=user, project_id=project_id, poi_batch_id=None
    )
    poi_summary, poi_for_map = summarize_pois_for_union(poi_graph)

    return {
        "stop_group_method": method,
        "radius_m": radius,
        "population_total": population_total,
        "poi_summary": poi_summary,
        "poi_for_map": poi_for_map,
    }
