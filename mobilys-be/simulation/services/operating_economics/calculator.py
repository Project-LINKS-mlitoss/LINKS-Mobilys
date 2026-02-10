from decimal import Decimal, ROUND_HALF_UP
from math import radians, sin, cos, asin, sqrt
from typing import Any, Dict, List, Optional

from django.db import connection, transaction

from simulation.models import OperatingEconomics
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService
from simulation.utils.decimals import round2, to_decimal_or_none


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0088
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return r * c


def compute_route_length_km_simple_mean_by_route_keyword(scenario_id: str, route_id: str) -> float:
    """
    SIMPLE MEAN across DISTINCT shapes for all routes that share the same keyword(s)
    as the given route_id, within the same scenario.
    If the route has no keyword mapping, falls back to the given route only.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            WITH selected_keywords AS (
              SELECT DISTINCT rkm.keyword_id
              FROM route_keyword_map rkm
              WHERE rkm.scenario_id = %s
                AND rkm.route_id = %s
            ),
            keyword_routes AS (
              SELECT DISTINCT rkm.route_id
              FROM route_keyword_map rkm
              JOIN selected_keywords sk ON sk.keyword_id = rkm.keyword_id
              WHERE rkm.scenario_id = %s
              UNION
              SELECT %s
              WHERE NOT EXISTS (SELECT 1 FROM selected_keywords)
            ),
            keyword_shapes AS (
              SELECT DISTINCT t.shape_id
              FROM trips t
              JOIN keyword_routes kr ON kr.route_id = t.route_id
              WHERE t.scenario_id = %s
                AND t.shape_id IS NOT NULL
            )
            SELECT s.shape_id, s.shape_pt_lat::float, s.shape_pt_lon::float, s.shape_pt_sequence
            FROM shapes s
            JOIN keyword_shapes ks ON ks.shape_id = s.shape_id
            WHERE s.scenario_id = %s
            ORDER BY s.shape_id, s.shape_pt_sequence
            """,
            [scenario_id, route_id, scenario_id, route_id, scenario_id, scenario_id],
        )
        rows = cursor.fetchall()

    lengths_km = []
    last_shape = None
    prev = None
    acc = 0.0

    for shape_id, lat, lon, _seq in rows:
        if last_shape is None:
            last_shape = shape_id
            prev = (lat, lon)
            continue

        if shape_id != last_shape:
            if acc > 0.0:
                lengths_km.append(acc)
            last_shape = shape_id
            prev = (lat, lon)
            acc = 0.0
            continue

        if prev is not None:
            acc += _haversine_km(prev[0], prev[1], lat, lon)
        prev = (lat, lon)

    if last_shape is not None and acc > 0.0:
        lengths_km.append(acc)

    return (sum(lengths_km) / len(lengths_km)) if lengths_km else 0.0


def get_route_fare_from_gtfs(scenario_id: str, route_id: str) -> Optional[int]:
    """
    Return a representative fare (yen) for a route by averaging the prices of
    FareAttribute rows referenced by FareRules for that route within the same scenario.
    If no fare is found, returns None.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT AVG(fa.price)::numeric
                FROM fare_rules fr
                JOIN fare_attributes fa
                  ON fa.id = fr.fare_attribute_id
                 AND fa.scenario_id = fr.scenario_id
                WHERE fr.scenario_id = %s
                  AND fr.route_id = %s
                """,
                [scenario_id, route_id],
            )
            row = cursor.fetchone()

        if not row or row[0] is None:
            return None

        return int(
            Decimal(str(row[0])).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )

    except Exception:
        return None


@log_service_call
@transaction.atomic
def operating_economics_calc(
    items: List[Dict[str, Any]],
    simulation_input,
    default_service_id: Optional[str] = None,
    default_fare: Optional[float] = None,
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []

    for body in items:
        try:
            simulation_id = body.get("simulation")
            route_id = (body.get("route_id") or "").strip()
            if not simulation_id or not route_id:
                continue

            sid = (body.get("service_id") or default_service_id or "").strip()
            if not sid and simulation_input and simulation_input.service_id:
                si = simulation_input.service_id.strip()
                if "," not in si:
                    sid = si
            if not sid:
                sid = "平日"
            delta_trips = to_decimal_or_none(body.get("delta_trips_per_day")) or Decimal("0")
            delta_users = to_decimal_or_none(body.get("delta_users_per_day")) or Decimal("0")
            if delta_trips == 0 or delta_users == 0:
                continue

            sim = SimulationService.find_simulation(simulation_id)
            if sim is None:
                continue

            raw_fare = get_route_fare_from_gtfs(sim.original_scenario_id, route_id)
            if raw_fare is None:
                if default_fare is None:
                    continue
                fare_yen = Decimal(str(default_fare))
            else:
                fare_yen = Decimal(int(raw_fare))

            with transaction.atomic():
                ops, _ = OperatingEconomics.objects.get_or_create(
                    simulation=sim,
                    route_id=route_id,
                    simulation_input=simulation_input,
                    service_id=sid,
                )

                route_length_km = ops.route_length_km
                if route_length_km is None:
                    rl = compute_route_length_km_simple_mean_by_route_keyword(
                        sim.original_scenario_id, route_id
                    )
                    route_length_km = Decimal(str(round(rl, 3))) if rl and rl > 0 else None
                    if route_length_km is not None:
                        ops.route_length_km = route_length_km
                        ops.save(update_fields=["route_length_km"])

                if route_length_km is None:
                    continue

                cost_per_vkm = to_decimal_or_none(body.get("cost_per_vkm_yen")) \
                    or Decimal(str(ops.cost_per_vkm_yen))

                delta_vehicle_km = route_length_km * delta_trips
                delta_cost_yen = round2(delta_vehicle_km * cost_per_vkm * Decimal("-1"))
                delta_revenue_yen = round2(delta_users * fare_yen)
                net_per_day_yen = round2(delta_revenue_yen + delta_cost_yen)
                annual_benefit_k_yen = round2(net_per_day_yen * Decimal("365") / Decimal("1000"))

                ops.service_id = sid
                ops.cost_per_vkm_yen = cost_per_vkm
                ops.delta_vehicle_km_per_day = delta_vehicle_km
                ops.fare_override_yen = fare_yen
                ops.delta_cost_yen_per_day = delta_cost_yen
                ops.delta_revenue_yen_per_day = delta_revenue_yen
                ops.net_per_day_yen = net_per_day_yen
                ops.annual_benefit_k_yen = annual_benefit_k_yen
                ops.status = "success"
                ops.save()

                results.append({
                    "simulation": sim.id,
                    "route_id": route_id,
                    "service_id": sid,
                    "route_length_km": float(route_length_km),
                    "fare_yen": float(fare_yen),
                    "cost_per_vkm_yen": float(cost_per_vkm),
                    "delta_trips_per_day": float(delta_trips),
                    "delta_users_per_day": float(delta_users),
                    "delta_vehicle_km_per_day": float(delta_vehicle_km),
                    "delta_cost_yen_per_day": float(delta_cost_yen),
                    "delta_revenue_yen_per_day": float(delta_revenue_yen),
                    "net_per_day_yen": float(net_per_day_yen),
                    "annual_benefit_k_yen": float(annual_benefit_k_yen),
                    "status": "success",
                })

        except Exception:
            continue

    return results
