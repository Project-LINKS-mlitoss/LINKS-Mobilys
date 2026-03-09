# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import unicodedata
from typing import Any, Dict, List, Optional, Union

from django.db import connection, transaction

from simulation.models import (
    Simulation,
    SimulationInput,
    CarRouting,
    CarRoutingSegment,
)
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService
from simulation.utils.decimals import to_decimal_or_none
from simulation.utils.number import to_float_or_zero

def _fetch_drm_bulk(link_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    if not link_ids:
        return {}
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT
              e.id,
              e.join_key,
              e.survey_unit,
              e.matchcode_shp,
              e.section_code_csv,
              e.road_name,
              e.length_m,
              e.lanes,
              e.updown_cd,
              e.speed_code,
              e.access_cd,
              e.toll_cd,
              e.motor_only_cd,
              e.travel_speed_model_kmh,
              e.speed_up_kmh,
              e.speed_dn_kmh,
              e.vol_up_24h,
              e.vol_dn_24h,
              e.traffic24_total,
              e.vol_up_12h,
              e.vol_dn_12h,
              e.traffic12_total,
              e.signal_density_per_km,
              e.congestion_index,
              e.imputed_from_join_key,
              e.imputation_method,
              e.source,
              e.target,
              e.cost,
              e.reverse_cost
            FROM drm_links e
            WHERE e.id = ANY(%s)
            """,
            [link_ids],
        )
        out: Dict[int, Dict[str, Any]] = {}
        cols = [c[0] for c in cur.description]
        for row in cur.fetchall():
            rec = dict(zip(cols, row))
            out[int(rec.pop("id"))] = rec
        return out


def _coalesce_baseline_24h(drm: Dict[str, Any]) -> float:
    v = drm.get("traffic24_total")
    if v is None or v == 0:
        v = (drm.get("vol_up_24h") or 0) + (drm.get("vol_dn_24h") or 0)
    return float(v or 0)


@log_service_call
def build_segment_volume_changes(
    sim3_results: Dict[str, Any],
    automobile_share: Union[float, Dict[str, float]],
    sim1_result: Union[float, Dict[str, Any], List[Dict[str, Any]]],
    *,
    scenario_key: str = "start",
    persist: bool = False,
    simulation: Union[int, str, Simulation, None] = None,
    simulation_input: Union[int, str, SimulationInput, None] = None,
) -> Dict[str, Any]:
    sim1_list: List[Dict[str, Any]] = []
    if isinstance(sim1_result, list):
        sim1_list = sim1_result
    elif isinstance(sim1_result, tuple):
        sim1_list = list(sim1_result)
    elif isinstance(sim1_result, dict):
        for key in ("routes", "data", "items", "result"):
            if isinstance(sim1_result.get(key), list):
                sim1_list = sim1_result[key]
                break
    else:
        try:
            if hasattr(sim1_result, "__iter__") and not isinstance(sim1_result, (str, bytes)):
                sim1_list = list(sim1_result)  # type: ignore[arg-type]
        except Exception:
            sim1_list = []

    delta_riders_by_route: Dict[str, float] = {}
    delta_trips_by_route: Dict[str, float] = {}
    if sim1_list:
        for rec in sim1_list:
            rid = (rec or {}).get("route_id")
            if not rid:
                continue
            delta_riders_by_route[rid] = to_float_or_zero((rec or {}).get("delta_riders_per_day"))
            delta_trips_by_route[rid] = to_float_or_zero((rec or {}).get("delta_trips_per_day"))

    def _share_for_route(rid: Any) -> float:
        if isinstance(automobile_share, dict):
            rid_key = rid
            return to_float_or_zero(
                automobile_share.get(rid) if rid in automobile_share else automobile_share.get(rid_key)
            )
        return to_float_or_zero(automobile_share)

    sim_obj = SimulationService.get_simulation_obj(simulation) if persist else None
    sim_input_obj = SimulationService.get_simulation_input_obj(simulation_input) if persist else None
    service_id_for_dir = sim3_results.get("service_id")

    routes_out: List[Dict[str, Any]] = []
    total_delta_cars_all_routes = 0.0

    for r in sim3_results.get("routes", []):
        rid = r.get("route_id") or r.get("route")
        rid_key = rid
        if not rid_key:
            continue

        scenario_id_for_dir = (
            ((r.get("scenarios", {}).get(scenario_key, {}) or {}).get("id"))
            or sim3_results.get(f"scenario_{scenario_key}")
        )

        shapes_in = (r.get("scenarios", {}).get(scenario_key, {}) or {}).get("shapes", [])
        if not shapes_in:
            shapes_in = r.get("shapes", [])

        if sim1_list:
            delta_riders = to_float_or_zero(delta_riders_by_route.get(rid_key))
            share = _share_for_route(rid)
            delta_trips_per_day = to_float_or_zero(delta_trips_by_route.get(rid_key))
            delta_cars_route = (delta_riders * share) - delta_trips_per_day
        else:
            delta_cars_route = to_float_or_zero(sim1_result) * _share_for_route(rid)
        total_delta_cars_all_routes += delta_cars_route or 0.0

        shapes_out: List[Dict[str, Any]] = []
        for s in shapes_in:
            shape_id = s.get("shape_id")

            direction_id = _infer_direction_id_for_shape(
                route_id=rid,
                shape_id=shape_id or "",
                scenario_id=scenario_id_for_dir,
                service_id=service_id_for_dir,
            )

            segs = ((s.get("car_path") or {}).get("segments") or [])
            link_ids = [int(seg.get("link_id")) for seg in segs if seg.get("link_id") is not None]
            drm_map = _fetch_drm_bulk(link_ids)

            segs_out: List[Dict[str, Any]] = []
            for seg in segs:
                lid = int(seg.get("link_id"))
                dm = drm_map.get(lid, {})
                length_m = float(dm.get("length_m") or seg.get("length_m") or 0.0)
                length_km = length_m / 1000.0

                v0 = _coalesce_baseline_24h(dm)
                v1 = v0 - delta_cars_route

                vkt0 = v0 * length_km
                vkt1 = v1 * length_km

                segs_out.append({
                    "matchcode_shp": dm.get("matchcode_shp"),
                    "section_code_csv": dm.get("section_code_csv"),
                    "road_name": dm.get("road_name"),
                    "length_m": int(length_m) if length_m else 0,
                    "lanes": dm.get("lanes"),
                    "updown_cd": dm.get("updown_cd"),
                    "speed_code": dm.get("speed_code"),
                    "access_cd": dm.get("access_cd"),
                    "toll_cd": dm.get("toll_cd"),
                    "motor_only_cd": dm.get("motor_only_cd"),
                    "travel_speed_model_kmh": float(dm.get("travel_speed_model_kmh")) if dm.get("travel_speed_model_kmh") is not None else None,
                    "speed_up_kmh": dm.get("speed_up_kmh"),
                    "speed_dn_kmh": dm.get("speed_dn_kmh"),
                    "vol_up_24h": dm.get("vol_up_24h"),
                    "vol_dn_24h": dm.get("vol_dn_24h"),
                    "traffic24_total": int(v0),
                    "vol_up_12h": dm.get("vol_up_12h"),
                    "vol_dn_12h": dm.get("vol_dn_12h"),
                    "traffic12_total": dm.get("traffic12_total") if dm.get("traffic12_total") is not None
                                         else ((dm.get("vol_up_12h") or 0) + (dm.get("vol_dn_12h") or 0)),
                    "before_cars_per_day": int(v0),
                    "after_cars_per_day": int(v1),
                    "before_vehicle_km_per_day": int(vkt0),
                    "after_vehicle_km_per_day": int(vkt1),
                })

            shapes_out.append({
                "shape_id": shape_id,
                "direction_id": direction_id,
                "segments": segs_out,
            })

        routes_out.append({
            "route_id": rid,
            "shapes": shapes_out,
        })

        if sim_obj:
            for s in shapes_in:
                _persist_car_results_for_route(
                    simulation=sim_obj,
                    shape=s,
                    simulation_input=sim_input_obj,
                    route_id=rid,
                    delta_persons=to_float_or_zero(delta_cars_route),
                    car_share=_share_for_route(rid),
                    delta_cars_shape=to_float_or_zero(delta_cars_route),
                    scenario_id=scenario_id_for_dir,
                    service_id=service_id_for_dir,
                )

    return {
        "car_change_number": float(total_delta_cars_all_routes),
        "service_id": service_id_for_dir,
        "routes": routes_out,
    }


def _persist_car_results_for_route(
    *,
    simulation: Simulation,
    simulation_input: Optional[SimulationInput],
    route_id: str,
    delta_persons: float,
    car_share: float,
    shape: Dict[str, Any],
    delta_cars_shape: float,
    scenario_id: Optional[str] = None,
    service_id: Optional[str] = None,
):
    if not simulation or not route_id or not shape:
        return

    start = shape.get("start") or {}
    end = shape.get("end") or {}
    shape_id = shape.get("shape_id") or ""

    direction_id = _infer_direction_id_for_shape(
        route_id=route_id,
        shape_id=shape_id,
        scenario_id=scenario_id,
        service_id=service_id,
    )

    with transaction.atomic():
        cr, created = CarRouting.objects.update_or_create(
            simulation=simulation,
            simulation_input=simulation_input,
            route_id=route_id,
            shape_id=shape_id,
            service_id=service_id,
            defaults={
                "shape_id": shape_id,
                "direction_id": direction_id,
                "service_id": service_id,
                "delta_demand_persons_day": to_decimal_or_none(delta_persons),
                "car_share": to_decimal_or_none(car_share),
                "start_lon": to_decimal_or_none(start.get("lon")),
                "start_lat": to_decimal_or_none(start.get("lat")),
                "end_lon": to_decimal_or_none(end.get("lon")),
                "end_lat": to_decimal_or_none(end.get("lat")),
            },
        )

        if not created and cr.direction_id != direction_id:
            cr.direction_id = direction_id
            cr.save(update_fields=["direction_id"])

        pg_segments: List[Dict[str, Any]] = ((shape.get("car_path") or {}).get("segments") or [])
        if not pg_segments:
            CarRoutingSegment.objects.filter(car_routing=cr).delete()
            return

        link_ids = [int(s.get("link_id")) for s in pg_segments if s.get("link_id") is not None]
        drm_map = _fetch_drm_bulk(link_ids)

        rows: List[CarRoutingSegment] = []
        seq_counter = 0
        for s in pg_segments:
            lid = int(s.get("link_id"))
            dm = drm_map.get(lid, {})

            v0 = _coalesce_baseline_24h(dm)
            v1 = v0 - delta_persons
            delta_v = v1 - v0

            seq_counter += 1
            rows.append(CarRoutingSegment(
                car_routing=cr,
                seq=int(s.get("seq") or seq_counter),
                link_id=lid,
                section_id=dm.get("join_key") or s.get("section_id"),
                road_name=dm.get("road_name") or s.get("road_name"),
                length_m=int(dm.get("length_m") or s.get("length_m") or 0) or None,
                lanes=dm.get("lanes"),
                speed_up_kmh=dm.get("speed_up_kmh"),
                speed_dn_kmh=dm.get("speed_dn_kmh"),
                baseline_cars_per_day=to_decimal_or_none(v0),
                delta_cars_per_day=to_decimal_or_none(delta_v),
                after_cars_per_day=to_decimal_or_none(v1),
                cost_min=(float(s.get("cost_min")) if s.get("cost_min") is not None else None),
                geometry=s.get("geometry"),
            ))

        CarRoutingSegment.objects.filter(car_routing=cr).delete()
        CarRoutingSegment.objects.bulk_create(rows, batch_size=1000)


def _infer_direction_id_for_shape(
    *,
    route_id: str,
    shape_id: str,
    scenario_id: Optional[str] = None,
    service_id: Optional[str] = None,
) -> int:
    params = [route_id, shape_id]
    where = ["t.route_id=%s", "t.shape_id=%s"]

    if scenario_id:
        where.append("t.scenario_id=%s")
        params.append(scenario_id)
    if service_id:
        where.append("t.service_id=%s")
        params.append(service_id)

    sql = f"""
        SELECT COALESCE(t.direction_id, 0) AS dir, COUNT(*) AS n
        FROM trips t
        WHERE {" AND ".join(where)}
        GROUP BY COALESCE(t.direction_id, 0)
        ORDER BY n DESC, dir ASC
        LIMIT 1;
    """

    with connection.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        if not row:
            return 0
        return int(row[0] or 0)
