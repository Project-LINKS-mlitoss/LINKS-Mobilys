from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from django.db import connection

from simulation.models import RidershipChange
from simulation.services.base import ValidationError, log_service_call, transactional
from simulation.services.simulation_service import SimulationService
from simulation.services.ridership_change.baselines import (
    compute_delta_riders,
    get_baseline_riders_from_icagg,
    get_baseline_trips_per_day_from_gtfs,
)
from simulation.utils.string import sort_key_casefold


def _trip_count_for_route(scenario_id: str, service_id: str, route_id: str) -> Decimal:
    if not (scenario_id and service_id and route_id):
        return Decimal("0")
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::numeric
            FROM trips
            WHERE scenario_id = %s
              AND route_id    = %s
              AND service_id  = %s
            """,
            [scenario_id, route_id, service_id],
        )
        row = cur.fetchone()
    return Decimal(row[0] or 0)


class RidershipChangeService:
    @staticmethod
    def _validate_calc_inputs(
        baseline_riders_per_day: Decimal,
        baseline_trips_per_day: Decimal,
        sensitivity_epsilon: Decimal,
    ) -> None:
        riders = Decimal(str(baseline_riders_per_day or 0))
        trips = Decimal(str(baseline_trips_per_day or 0))
        epsilon = Decimal(str(sensitivity_epsilon or 0))

        if riders < Decimal("0"):
            raise ValidationError(
                message="baseline_riders_per_day must be >= 0",
                details={"non_field_errors": ["baseline_riders_per_day must be >= 0"]},
            )
        if trips <= Decimal("0"):
            raise ValidationError(
                message="baseline_trips_per_day must be > 0",
                details={"non_field_errors": ["baseline_trips_per_day must be > 0"]},
            )
        if epsilon < Decimal("0"):
            raise ValidationError(
                message="sensitivity_epsilon must be >= 0",
                details={"non_field_errors": ["sensitivity_epsilon must be >= 0"]},
            )

    @staticmethod
    @log_service_call
    def list_changes(simulation_id: Optional[str] = None, day_type: Optional[str] = None):
        qs = RidershipChange.objects.select_related("simulation__original_scenario").order_by("id")
        if simulation_id:
            qs = qs.filter(simulation_id=simulation_id)
        if day_type:
            qs = qs.filter(day_type=day_type)
        return qs

    @staticmethod
    @log_service_call
    def get_defaults(
        simulation_id: int,
        route_id: str,
        day_type: str,
        service_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario", "duplicated_scenario"),
            not_found_message="Simulation not found",
        )

        sim_input = sim.inputs.order_by("-created_at").first()
        d0 = get_baseline_riders_from_icagg(sim_input, route_id, service_id)

        if service_id:
            b0 = _trip_count_for_route(sim.original_scenario_id, service_id, route_id)
            b1 = _trip_count_for_route(sim.duplicated_scenario_id, service_id, route_id)
            db = (b1 - b0).to_integral_value(rounding=ROUND_HALF_UP)
        else:
            b0 = get_baseline_trips_per_day_from_gtfs(
                sim.original_scenario_id, route_id, service_id=service_id
            )
            b1 = None
            db = Decimal("0")

        eps = Decimal("0.5")
        if sim_input is not None:
            eps_up = Decimal(str(sim_input.sensitivity_up or 0))
            eps_down = Decimal(str(sim_input.sensitivity_down or 0))
            eps = eps_down if (service_id and db < 0) else eps_up

        rc, _created = RidershipChange.objects.get_or_create(
            simulation=sim,
            route_id=route_id,
            day_type=day_type,
            defaults=dict(
                baseline_riders_per_day=d0,
                baseline_trips_per_day=b0,
                delta_trips_per_day=db,
                sensitivity_epsilon=eps,
                gtfs_service_id=service_id or None,
                status="draft",
            ),
        )

        baseline_trips = rc.baseline_trips_per_day if rc.baseline_trips_per_day is not None else b0
        baseline_riders = rc.baseline_riders_per_day if rc.baseline_riders_per_day is not None else d0
        epsilon = rc.sensitivity_epsilon if rc.sensitivity_epsilon is not None else eps
        delta_trips = rc.delta_trips_per_day if rc.delta_trips_per_day is not None else db

        return {
            "simulation": sim.id,
            "route_id": route_id,
            "day_type": day_type,
            "service_id": service_id,
            "baseline_trips_per_day": float(baseline_trips),
            "trips_scenario2_per_day": float(b1) if b1 is not None else None,
            "delta_trips_per_day": float(delta_trips),
            "baseline_riders_per_day": float(baseline_riders),
            "sensitivity_epsilon": float(epsilon),
            "status": rc.status,
        }

    @staticmethod
    @log_service_call
    @transactional
    def calculate(
        simulation_id: int,
        route_id: str,
        day_type: str,
        baseline_riders_per_day: Decimal,
        baseline_trips_per_day: Decimal,
        delta_trips_per_day: Decimal,
        sensitivity_epsilon: Decimal,
    ) -> Dict[str, Any]:
        RidershipChangeService._validate_calc_inputs(
            baseline_riders_per_day=baseline_riders_per_day,
            baseline_trips_per_day=baseline_trips_per_day,
            sensitivity_epsilon=sensitivity_epsilon,
        )

        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario",),
            not_found_message="Simulation not found",
        )

        rc, _ = RidershipChange.objects.get_or_create(
            simulation=sim,
            route_id=route_id,
            day_type=day_type,
        )

        dB_dec = Decimal(str(delta_trips_per_day)).to_integral_value(rounding=ROUND_HALF_UP)
        D0_dec = Decimal(str(baseline_riders_per_day or 0))
        B0_dec = Decimal(str(baseline_trips_per_day or 0))
        eps_dec = Decimal(str(sensitivity_epsilon or 0))

        rc.baseline_riders_per_day = D0_dec
        rc.baseline_trips_per_day = B0_dec
        rc.delta_trips_per_day = dB_dec
        rc.sensitivity_epsilon = eps_dec

        dD = compute_delta_riders(
            D0=D0_dec,
            B0=B0_dec,
            dB=dB_dec,
            eps=eps_dec,
        )

        rc.delta_riders_per_day = dD
        rc.status = "success"
        rc.save()

        return {
            "simulation": sim.id,
            "route_id": route_id,
            "day_type": day_type,
            "baseline_trips_per_day": float(B0_dec),
            "baseline_riders_per_day": float(D0_dec),
            "delta_trips_per_day": float(dB_dec),
            "sensitivity_epsilon": float(eps_dec),
            "delta_riders_per_day": dD,
            "status": rc.status,
        }

    @staticmethod
    @log_service_call
    def get_changed_routes(simulation_id: int, service_id: str) -> tuple[List[Dict[str, Any]], bool]:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario", "duplicated_scenario"),
            not_found_message="Simulation not found",
        )

        orig_id = sim.original_scenario_id
        dup_id = sim.duplicated_scenario_id
        if not (orig_id and dup_id):
            return [], True

        with connection.cursor() as cur:
            cur.execute(
                """
                WITH counts AS (
                  SELECT scenario_id, route_id, COUNT(*)::numeric AS n
                  FROM trips
                  WHERE service_id = %s AND scenario_id IN (%s, %s)
                  GROUP BY scenario_id, route_id
                ),
                orig AS (
                  SELECT route_id, n AS b0 FROM counts WHERE scenario_id = %s
                ),
                dup AS (
                  SELECT route_id, n AS b1 FROM counts WHERE scenario_id = %s
                )
                SELECT
                  COALESCE(o.route_id, d.route_id) AS route_id,
                  COALESCE(o.b0, 0) AS b0,
                  COALESCE(d.b1, 0) AS b1,
                  COALESCE(d.b1, 0) - COALESCE(o.b0, 0) AS delta
                FROM orig o
                FULL OUTER JOIN dup d USING (route_id)
                WHERE COALESCE(d.b1, 0) <> COALESCE(o.b0, 0)
                ORDER BY abs(COALESCE(d.b1, 0) - COALESCE(o.b0, 0)) DESC, route_id
                """,
                [service_id, str(orig_id), str(dup_id), str(orig_id), str(dup_id)],
            )
            rows = cur.fetchall()

        return [
            {
                "route_id": r[0],
                "baseline_trips_per_day": float(r[1]),
                "trips_scenario2_per_day": float(r[2]),
                "delta_trips_per_day": float(r[3]),
            }
            for r in rows
        ], False

    @staticmethod
    @log_service_call
    def get_patterns(
        simulation_id: str,
        day_type: Optional[str] = None,
        service_ids_param: Optional[str] = None,
    ) -> Dict[str, Any]:
        rc_qs = (
            RidershipChange.objects
            .filter(simulation_id=simulation_id)
            .select_related("simulation__original_scenario")
        )
        if day_type:
            rc_qs = rc_qs.filter(day_type=day_type)

        if service_ids_param:
            target_sids = [s.strip() for s in service_ids_param.split(",") if s.strip()]
            rc_qs = rc_qs.filter(gtfs_service_id__in=target_sids)
        else:
            target_sids = list(
                rc_qs.exclude(gtfs_service_id__isnull=True)
                     .exclude(gtfs_service_id__exact="")
                     .values_list("gtfs_service_id", flat=True)
                     .distinct()
            )
        rc_sids_by_route = {}
        for rid, sid in rc_qs.values_list("route_id", "gtfs_service_id"):
            rc_sids_by_route.setdefault(rid, set()).add(sid)

        route_ids = sorted(rc_sids_by_route.keys(), key=sort_key_casefold)
        if not route_ids or not target_sids:
            return {
                "simulation": simulation_id,
                "service_ids": target_sids,
                "routes": [],
            }

        rc_map = {}
        for rc in rc_qs.order_by("route_id", "gtfs_service_id", "-id"):
            k = (rc.route_id, rc.gtfs_service_id)
            if k not in rc_map:
                rc_map[k] = rc

        flat_routes = []
        for rid in route_ids:
            sids_for_route = sorted(
                (rc_sids_by_route.get(rid) or set()) & set(target_sids),
                key=sort_key_casefold,
            )
            for sid in sids_for_route:
                rc = rc_map.get((rid, sid))
                rc_data = rc

                flat_routes.append({
                    "route_id": rid,
                    "service_id": sid,
                    "ridership_change": rc_data,
                })

        return {
            "simulation": simulation_id,
            "service_ids": sorted(set(target_sids), key=sort_key_casefold),
            "routes": flat_routes,
        }
