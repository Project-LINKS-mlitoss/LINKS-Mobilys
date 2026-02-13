# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging
from typing import Any, Dict, List, Optional, Tuple

from django.db import connection
from gtfs.models import Scenario
from simulation.constants.colors import ColorConstants

logger = logging.getLogger(__name__)

def check_scenario_is_duplicated(scenario_a: str, scenario_b: str) -> bool:
    scenario_a_data = Scenario.objects.filter(id=scenario_a).first()
    scenario_b_data = Scenario.objects.filter(id=scenario_b).first()

    if not scenario_a_data or not scenario_b_data:
        return False

    if not scenario_b_data.source_scenario == scenario_a_data:
        return False

    return True

def _stable_fallback_color(route_id: str) -> str:
    h = 0
    for ch in (route_id or ""):
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return ColorConstants.PALETTE[h % len(ColorConstants.PALETTE)]

def _get_route_meta_and_color(route_id: str, scenario_id: str) -> Dict[str, Any]:
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(NULLIF(r.route_long_name,''), r.route_short_name, r.route_id) AS name,
                   NULLIF(r.route_color,'') AS gtfs_color
            FROM routes r
            WHERE r.scenario_id=%s AND r.route_id=%s
            LIMIT 1;
            """,
            [scenario_id, route_id],
        )
        row = cur.fetchone()
        route_name = row[0] if row else route_id
        gtfs_color = (row[1] or "").lower() if row and row[1] else None

        cur.execute(
            """
            SELECT LOWER(k.keyword_color)
            FROM route_keyword_map m
            JOIN route_keywords k ON k.id = m.keyword_id
            WHERE m.scenario_id=%s AND m.route_id=%s
            ORDER BY m.can_automatically_update DESC, k.updated_datetime DESC
            LIMIT 1;
            """,
            [scenario_id, route_id],
        )
        kw = cur.fetchone()
        if kw and kw[0]:
            color_hex = kw[0]
        elif gtfs_color:
            color_hex = gtfs_color
        else:
            color_hex = _stable_fallback_color(route_id)

        color_hex = color_hex.replace("#", "")
        color_hex = (color_hex + "000000")[:6]

    return {"route_name": route_name, "color_hex": color_hex}

def _get_shapes_for_route(
    route_id: str,
    scenario_id: str,
    service_id: str,
    limit_shapes: Optional[int] = None,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    with connection.cursor() as cur:
        limit_sql = "" if not limit_shapes else f"LIMIT {int(limit_shapes)}"
        cur.execute(
            f"""
            WITH t AS (
              SELECT t.shape_id
              FROM trips t
              WHERE t.route_id=%s AND t.scenario_id=%s AND t.service_id=%s
                    AND t.shape_id IS NOT NULL AND t.shape_id <> ''
            ),
            c AS (
              SELECT shape_id, COUNT(*) AS n_trips
              FROM t
              GROUP BY shape_id
              ORDER BY n_trips DESC
              {limit_sql}
            ),
            pts AS (
              SELECT s.shape_id, s.shape_pt_lon AS lon, s.shape_pt_lat AS lat, s.shape_pt_sequence AS seq
              FROM shapes s
              JOIN c ON c.shape_id = s.shape_id
              WHERE s.scenario_id=%s
            ),
            lines AS (
              SELECT shape_id,
                     ST_MakeLine(ST_SetSRID(ST_Point(lon,lat),4326) ORDER BY seq) AS geom
              FROM pts
              GROUP BY shape_id
            )
            SELECT c.shape_id, c.n_trips,
                   ST_X(ST_StartPoint(l.geom)) AS lonA,
                   ST_Y(ST_StartPoint(l.geom)) AS latA,
                   ST_X(ST_EndPoint(l.geom))   AS lonB,
                   ST_Y(ST_EndPoint(l.geom))   AS latB,
                   ST_AsText(l.geom)           AS wkt,
                   ST_AsGeoJSON(l.geom, 6)::json AS geojson
            FROM c
            JOIN lines l USING (shape_id);
            """,
            [route_id, scenario_id, service_id, scenario_id],
        )
        for r in cur.fetchall():
            shape_id, n, lon_a, lat_a, lon_b, lat_b, wkt, geojson = r
            out.append({
                "shape_id": shape_id,
                "trips_count": int(n),
                "start": {"lon": float(lon_a), "lat": float(lat_a)},
                "end": {"lon": float(lon_b), "lat": float(lat_b)},
                "wkt": str(wkt),
                "gtfs_shape": {
                    "type": "Feature",
                    "geometry": geojson,
                    "properties": {"shape_id": shape_id},
                },
            })
    return out


def _get_shape_id_for_trip(trip_id: Optional[str], scenario_id: Optional[str]) -> Optional[str]:
    if not trip_id or not scenario_id:
        return None
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT shape_id
            FROM trips
            WHERE scenario_id=%s AND trip_id=%s
              AND shape_id IS NOT NULL AND shape_id <> ''
            LIMIT 1;
            """,
            [scenario_id, trip_id],
        )
        row = cur.fetchone()
    if not row:
        return None
    return row[0]


def _filter_shapes_by_id(shapes: List[Dict[str, Any]], shape_id: Optional[str]) -> List[Dict[str, Any]]:
    if not shape_id:
        return shapes
    filtered = [s for s in shapes if s.get("shape_id") == shape_id]
    return filtered if filtered else shapes


def _build_edges_sql(
    csv_penalty_factor: float = 10.0,
    bus_wkt: Optional[str] = None,
    bus_buffer_m: int = 60,
    bus_multiplier: float = 1.0,
    constrain_to_buffer: bool = False,
) -> Tuple[str, List]:
    csv_cost = (
        "CASE WHEN e.section_code_csv IS NOT NULL"
        " THEN COALESCE(e.cost,1e7)"
        " ELSE COALESCE(e.cost,1e7) * %s END"
    )
    csv_rcost = (
        "CASE WHEN e.section_code_csv IS NOT NULL"
        " THEN COALESCE(e.reverse_cost,1e7)"
        " ELSE COALESCE(e.reverse_cost,1e7) * %s END"
    )

    base_where = "LEAST(COALESCE(e.cost,1e9), COALESCE(e.reverse_cost,1e9)) < 1e8"

    if constrain_to_buffer and bus_wkt:
        where_clause = (
            f"{base_where}"
            " AND ST_DWithin(e.geom::geography,"
            " ST_SetSRID(ST_GeomFromText(%s),4326)::geography, %s)"
        )
        edges_sql = f"""
         SELECT e.id, e.source, e.target,
           ({csv_cost}) AS cost,
           ({csv_rcost}) AS reverse_cost
         FROM drm_links e
         WHERE {where_clause}
        """
        edges_params = [csv_penalty_factor, csv_penalty_factor, bus_wkt, bus_buffer_m]
    elif bus_wkt and bus_multiplier < 1.0:
        edges_sql = f"""
         SELECT e.id, e.source, e.target,
           ({csv_cost})
             * CASE WHEN ST_DWithin(e.geom::geography,
                        ST_SetSRID(ST_GeomFromText(%s),4326)::geography, %s)
                    THEN {bus_multiplier} ELSE 1.0 END AS cost,
           ({csv_rcost})
             * CASE WHEN ST_DWithin(e.geom::geography,
                        ST_SetSRID(ST_GeomFromText(%s),4326)::geography, %s)
                    THEN {bus_multiplier} ELSE 1.0 END AS reverse_cost
         FROM drm_links e
         WHERE {base_where}
        """
        edges_params = [
            csv_penalty_factor, bus_wkt, bus_buffer_m,
            csv_penalty_factor, bus_wkt, bus_buffer_m,
        ]
    else:
        edges_sql = f"""
         SELECT e.id, e.source, e.target,
           ({csv_cost}) AS cost,
           ({csv_rcost}) AS reverse_cost
         FROM drm_links e
         WHERE {base_where}
        """
        edges_params = [csv_penalty_factor, csv_penalty_factor]

    return edges_sql, edges_params


def _rows_to_car_result(rows: list) -> Dict[str, Any]:
    if not rows:
        return {"summary": {"distance_km": 0.0, "est_time_min": 0.0, "edges": 0}, "segments": []}

    (i_seq, i_edge, i_seg,
     i_sec, i_road, i_len, i_lanes, i_spu, i_spd, i_vu, i_vd, i_vtot,
     i_geom, i_dist, i_est, i_edges) = range(16)

    segs_out: List[Dict[str, Any]] = []
    for r in rows:
        baseline = r[i_vtot] if r[i_vtot] is not None else ((r[i_vu] or 0) + (r[i_vd] or 0))
        segs_out.append({
            "seq": int(r[i_seq]),
            "link_id": int(r[i_edge]),
            "section_id": r[i_sec],
            "road_name": r[i_road],
            "length_m": int(r[i_len]) if r[i_len] is not None else None,
            "lanes": int(r[i_lanes]) if r[i_lanes] is not None else None,
            "speed_up_kmh": float(r[i_spu]) if r[i_spu] is not None else None,
            "speed_dn_kmh": float(r[i_spd]) if r[i_spd] is not None else None,
            "baseline_cars_per_day": float(baseline) if baseline is not None else None,
            "cost_min": float(r[i_seg]),
            "geometry": r[i_geom],
        })

    return {
        "summary": {
            "distance_km": float(rows[0][i_dist]),
            "est_time_min": float(rows[0][i_est]),
            "edges": int(rows[0][i_edges]),
        },
        "segments": segs_out,
    }


# ---------------------------------------------------------------------------
# Map-match bus WKT to DRM edges
# ---------------------------------------------------------------------------

def _map_match_bus_to_drm(
    bus_wkt: str,
    buffer_m: int = 30,
) -> List[Dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(
            """
            WITH bus AS (
                SELECT ST_SetSRID(ST_GeomFromText(%s), 4326) AS geom
            ),
            candidates AS (
                SELECT
                    e.id, e.source, e.target, e.geom,
                    e.section_code_csv,
                    ST_LineLocatePoint(
                        b.geom,
                        ST_ClosestPoint(b.geom, ST_Centroid(e.geom))
                    ) AS frac,
                    ST_Distance(e.geom::geography, b.geom::geography) AS dist_m,
                    ST_LineLocatePoint(
                        b.geom,
                        ST_ClosestPoint(b.geom, vs.the_geom)
                    ) AS source_frac,
                    ST_LineLocatePoint(
                        b.geom,
                        ST_ClosestPoint(b.geom, vt.the_geom)
                    ) AS target_frac
                FROM drm_links e
                JOIN drm_links_vertices_pgr vs ON vs.id = e.source
                JOIN drm_links_vertices_pgr vt ON vt.id = e.target
                CROSS JOIN bus b
                WHERE ST_DWithin(e.geom::geography, b.geom::geography, %s)
                  AND LEAST(COALESCE(e.cost,1e9), COALESCE(e.reverse_cost,1e9)) < 1e8
            ),
            angled AS (
                SELECT
                    c.id, c.source, c.target, c.section_code_csv,
                    c.frac, c.dist_m, c.source_frac, c.target_frac,
                    DEGREES(
                        LEAST(
                            ABS(ATAN2(SIN(edge_az - bus_az), COS(edge_az - bus_az))),
                            ABS(
                                PI() - ABS(ATAN2(SIN(edge_az - bus_az), COS(edge_az - bus_az)))
                            )
                        )
                    ) AS angle_deg
                FROM (
                    SELECT
                        c.*,
                        ST_Azimuth(ST_StartPoint(c.geom), ST_EndPoint(c.geom)) AS edge_az,
                        ST_Azimuth(
                            ST_LineInterpolatePoint(b.geom, GREATEST(0.0, c.frac - 0.002)),
                            ST_LineInterpolatePoint(b.geom, LEAST(1.0, c.frac + 0.002))
                        ) AS bus_az
                    FROM candidates c
                    CROSS JOIN bus b
                ) c
            ),
            best AS (
                SELECT DISTINCT ON (round(frac * 200)::int)
                    id,
                    CASE WHEN target_frac >= source_frac THEN source ELSE target END AS source,
                    CASE WHEN target_frac >= source_frac THEN target ELSE source END AS target,
                    frac, dist_m
                FROM angled
                WHERE angle_deg <= 60
                ORDER BY round(frac * 200)::int,
                         (CASE WHEN section_code_csv IS NOT NULL THEN 0 ELSE 1 END),
                         dist_m
            )
            SELECT id, source, target, frac
            FROM best
            ORDER BY frac;
            """,
            [bus_wkt, buffer_m],
        )
        return [
            {"id": r[0], "source": r[1], "target": r[2], "frac": float(r[3])}
            for r in cur.fetchall()
        ]


def _connect_matched_edges(
    matched: List[Dict[str, Any]],
    bus_wkt: str,
    buffer_m: int,
    csv_penalty_factor: float,
) -> Dict[str, Any]:
    if not matched:
        return {"summary": {"distance_km": 0.0, "est_time_min": 0.0, "edges": 0}, "segments": []}

    gap_edges_sql, gap_edges_params = _build_edges_sql(
        csv_penalty_factor=csv_penalty_factor,
        bus_wkt=bus_wkt,
        bus_buffer_m=max(30, buffer_m * 2),
        constrain_to_buffer=True,
    )

    ordered = sorted(matched, key=lambda m: m.get("frac", 0.0))
    stitched_ids: List[int] = [int(ordered[0]["id"])]
    prev = ordered[0]

    with connection.cursor() as cur:
        for nxt in ordered[1:]:
            prev_to = int(prev["target"])
            nxt_from = int(nxt["source"])

            if prev_to != nxt_from:
                try:
                    cur.execute(
                        f"""
                        SELECT edge
                        FROM pgr_dijkstra(
                            $$ {gap_edges_sql} $$, %s, %s, directed := true
                        )
                        WHERE edge <> -1;
                        """,
                        [*gap_edges_params, prev_to, nxt_from],
                    )
                    gap_ids = [int(r[0]) for r in cur.fetchall()]
                    if gap_ids:
                        stitched_ids.extend(gap_ids)
                    else:
                        logger.debug(
                            "No constrained gap path between edge=%s(target=%s) and edge=%s(source=%s)",
                            prev.get("id"), prev_to, nxt.get("id"), nxt_from,
                        )
                except Exception:
                    logger.debug(
                        "Gap-fill dijkstra failed between edge=%s and edge=%s",
                        prev.get("id"), nxt.get("id"),
                        exc_info=True,
                    )

            stitched_ids.append(int(nxt["id"]))
            prev = nxt

    edge_ids: List[int] = []
    for eid in stitched_ids:
        if not edge_ids or edge_ids[-1] != eid:
            edge_ids.append(eid)

    if not edge_ids:
        return {"summary": {"distance_km": 0.0, "est_time_min": 0.0, "edges": 0}, "segments": []}

    with connection.cursor() as cur:
        cur.execute(
            """
            WITH edge_order AS (
                SELECT id, ordinality AS seq
                FROM unnest(%s::bigint[]) WITH ORDINALITY AS t(id, ordinality)
            ),
            segs AS (
                SELECT
                    eo.seq,
                    e.id AS edge,
                    COALESCE(e.cost, 0) AS seg_time_min,
                    e.join_key AS section_id, e.road_name, e.length_m, e.lanes,
                    e.speed_up_kmh, e.speed_dn_kmh,
                    e.vol_up_24h, e.vol_dn_24h, e.traffic24_total,
                    ST_AsGeoJSON(e.geom, 6)::json AS geom
                FROM edge_order eo
                JOIN drm_links e ON e.id = eo.id
            ),
            sums AS (
                SELECT COUNT(*) AS n_edges,
                       COALESCE(SUM(length_m)/1000.0, 0) AS distance_km,
                       COALESCE(SUM(seg_time_min), 0) AS est_time_min
                FROM segs
            )
            SELECT
                s.seq, s.edge, s.seg_time_min,
                s.section_id, s.road_name, s.length_m, s.lanes,
                s.speed_up_kmh, s.speed_dn_kmh,
                s.vol_up_24h, s.vol_dn_24h, s.traffic24_total,
                s.geom,
                (SELECT distance_km FROM sums),
                (SELECT est_time_min FROM sums),
                (SELECT n_edges FROM sums)
            FROM segs s
            ORDER BY s.seq;
            """,
            [edge_ids],
        )
        return _rows_to_car_result(cur.fetchall())


def _dijkstra_between_points(
    lon_a: float, lat_a: float,
    lon_b: float, lat_b: float,
    edges_sql: str, edges_params: List,
) -> Dict[str, Any]:
    with connection.cursor() as cur:
        cur.execute(
            """
            WITH a AS (SELECT id FROM drm_links_vertices_pgr
                       ORDER BY the_geom <-> ST_SetSRID(ST_Point(%s,%s),4326) LIMIT 1),
                 b AS (SELECT id FROM drm_links_vertices_pgr
                       ORDER BY the_geom <-> ST_SetSRID(ST_Point(%s,%s),4326) LIMIT 1)
            SELECT (SELECT id FROM a), (SELECT id FROM b);
            """,
            [lon_a, lat_a, lon_b, lat_b],
        )
        a_id, b_id = cur.fetchone()

        cur.execute(
            f"""
            WITH route AS (
              SELECT * FROM pgr_dijkstra($$ {edges_sql} $$, %s, %s, directed := true)
              WHERE edge <> -1
            ),
            segs AS (
              SELECT
                ROW_NUMBER() OVER () AS seq,
                r.edge,
                COALESCE(e.cost, 0) AS seg_time_min,
                e.join_key AS section_id, e.road_name, e.length_m, e.lanes,
                e.speed_up_kmh, e.speed_dn_kmh,
                e.vol_up_24h, e.vol_dn_24h, e.traffic24_total,
                ST_AsGeoJSON(e.geom, 6)::json AS geom
              FROM route r
              JOIN drm_links e ON e.id = r.edge
            ),
            sums AS (
              SELECT COUNT(*) AS n_edges,
                     SUM(length_m)/1000.0 AS distance_km,
                     SUM(seg_time_min)    AS est_time_min
              FROM segs
            )
            SELECT
              s.seq, s.edge, s.seg_time_min,
              s.section_id, s.road_name, s.length_m, s.lanes,
              s.speed_up_kmh, s.speed_dn_kmh,
              s.vol_up_24h, s.vol_dn_24h, s.traffic24_total,
              s.geom,
              (SELECT distance_km FROM sums),
              (SELECT est_time_min FROM sums),
              (SELECT n_edges FROM sums)
            FROM segs s
            ORDER BY s.seq;
            """,
            [*edges_params, a_id, b_id],
        )
        return _rows_to_car_result(cur.fetchall())


def _car_path_for_endpoints(
    lon_a: float,
    lat_a: float,
    lon_b: float,
    lat_b: float,
    csv_penalty_factor: float = 10.0,
) -> Dict[str, Any]:
    edges_sql, edges_params = _build_edges_sql(csv_penalty_factor=csv_penalty_factor)
    return _dijkstra_between_points(lon_a, lat_a, lon_b, lat_b, edges_sql, edges_params)


def _car_route_for_shape(
    s: Dict[str, Any],
    prefer_bus: bool,
    bus_buffer_m: int,
    csv_penalty_factor: float,
) -> Dict[str, Any]:
    wkt = s.get("wkt")
    lon_a, lat_a = s["start"]["lon"], s["start"]["lat"]
    lon_b, lat_b = s["end"]["lon"], s["end"]["lat"]

    if not wkt:
        return _car_path_for_endpoints(lon_a, lat_a, lon_b, lat_b, csv_penalty_factor)

    # Soft follow mode (prefer_bus=False):
    # Keep routing globally connected and stable for downstream calculations,
    # but bias costs around bus shape so route still tends to follow the bus corridor.
    if not prefer_bus:
        # Conservative settings: keep bias mild to avoid unstable path shifts.
        requested_buffer = int(bus_buffer_m) if bus_buffer_m else 60
        soft_buffer_m = max(45, min(requested_buffer, 120))
        for soft_multiplier in (0.80, 0.70):
            try:
                edges_sql, edges_params = _build_edges_sql(
                    csv_penalty_factor=csv_penalty_factor,
                    bus_wkt=wkt,
                    bus_buffer_m=soft_buffer_m,
                    bus_multiplier=soft_multiplier,
                )
                result = _dijkstra_between_points(
                    lon_a, lat_a, lon_b, lat_b, edges_sql, edges_params,
                )
                if result["summary"]["edges"] > 0:
                    logger.info(
                        "Soft bus-follow routing succeeded (buffer=%dm, multiplier=%.2f)",
                        soft_buffer_m, soft_multiplier,
                    )
                    return result
            except Exception:
                logger.debug(
                    "Soft bus-follow routing failed (buffer=%dm, multiplier=%.2f)",
                    soft_buffer_m, soft_multiplier,
                    exc_info=True,
                )

        return _car_path_for_endpoints(lon_a, lat_a, lon_b, lat_b, csv_penalty_factor)

    # --- Fallback 1: Map-match bus WKT to DRM edges ---
    try:
        matched = _map_match_bus_to_drm(wkt, buffer_m=bus_buffer_m)
        if len(matched) >= 3:
            result = _connect_matched_edges(matched, wkt, bus_buffer_m, csv_penalty_factor)
            if result["summary"]["edges"] > 0:
                logger.info("Map-match succeeded: %d matched edges", len(matched))
                return result
    except Exception:
        logger.warning("Map-match failed, trying constrained Dijkstra", exc_info=True)

    # --- Fallback 2: Constrained Dijkstra with progressive buffer widening ---
    dijkstra_buffers = [30, 60, 150, 300]
    if bus_buffer_m and bus_buffer_m > 0:
        dijkstra_buffers = sorted(set([*dijkstra_buffers, max(30, int(bus_buffer_m))]))

    for buf in dijkstra_buffers:
        try:
            edges_sql, edges_params = _build_edges_sql(
                csv_penalty_factor=csv_penalty_factor,
                bus_wkt=wkt,
                bus_buffer_m=buf,
                constrain_to_buffer=True,
            )
            result = _dijkstra_between_points(
                lon_a, lat_a, lon_b, lat_b, edges_sql, edges_params,
            )
            if result["summary"]["edges"] > 0:
                logger.info("Constrained Dijkstra succeeded at buffer=%dm", buf)
                return result
        except Exception:
            logger.debug("Constrained Dijkstra failed at buffer=%dm", buf, exc_info=True)

    # --- Fallback 3: Aggressive bus penalty (0.01 multiplier = 100x preference) ---
    try:
        edges_sql, edges_params = _build_edges_sql(
            csv_penalty_factor=csv_penalty_factor,
            bus_wkt=wkt,
            bus_buffer_m=max(bus_buffer_m, 60),
            bus_multiplier=0.01,
        )
        result = _dijkstra_between_points(
            lon_a, lat_a, lon_b, lat_b, edges_sql, edges_params,
        )
        if result["summary"]["edges"] > 0:
            logger.info("Aggressive penalty Dijkstra succeeded")
            return result
    except Exception:
        logger.warning("Aggressive penalty Dijkstra failed", exc_info=True)

    # --- Fallback 4: Plain endpoint routing ---
    return _car_path_for_endpoints(lon_a, lat_a, lon_b, lat_b, csv_penalty_factor)


