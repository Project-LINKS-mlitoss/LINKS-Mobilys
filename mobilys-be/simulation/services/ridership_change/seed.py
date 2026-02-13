# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging
from datetime import date as dt_date
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

from django.db import transaction

from simulation.models import RidershipChange, SimulationInput
from simulation.services.ridership_change.baselines import (
    compute_delta_riders,
    get_baseline_trips_per_day_from_gtfs,
)

logger = logging.getLogger(__name__)


def _seed_ridership_changes(
    sim_input: SimulationInput,
    service_ids: Iterable[str] | str,
    date: Optional[dt_date] = None,
) -> list[dict]:
    if isinstance(service_ids, str):
        svc_list = [s.strip() for s in service_ids.split(",") if s.strip()]
    else:
        svc_list = [str(s).strip() for s in (service_ids or []) if str(s).strip()]

    results: list[dict] = []
    try:
        ic_agg = sim_input.ic_agg or {}
        trip_selection = ic_agg.get("__trip_selection__") or {}
        sim = sim_input.simulation
        if not ic_agg:
            logger.info("No ic_agg entries; nothing to seed.")
            return results

        by_date = (ic_agg.get("__by_date__") or {}) if isinstance(ic_agg, dict) else {}
        per_route_by_date = (by_date.get(date.isoformat()) if (date and isinstance(by_date, dict)) else None)

        with transaction.atomic():
            for sid in svc_list:
                if per_route_by_date and isinstance(per_route_by_date, dict):
                    per_route = per_route_by_date.get(sid, {})
                else:
                    per_route = ic_agg.get(sid, {})

                if not per_route:
                    logger.info(
                        "No ic_agg entries for service_id=%s at date=%s; skip.",
                        sid,
                        (date.isoformat() if date else None),
                    )
                    continue

                for route_id_raw, d0_val in per_route.items():
                    trip_id = None
                    try:
                        route_id = route_id_raw

                        route_trip_map = trip_selection.get(sid, {})
                        trip_id = route_trip_map.get(route_id)

                        b0_orig = get_baseline_trips_per_day_from_gtfs(
                            sim.original_scenario_id, route_id, sid
                        )
                        b1_dup = get_baseline_trips_per_day_from_gtfs(
                            sim.duplicated_scenario_id, route_id, sid
                        )

                        d0_dec = Decimal(str(d0_val or 0))
                        b0_dec = Decimal(str(b0_orig or 0))
                        db_dec = (
                            Decimal(str(b1_dup or 0)) - Decimal(str(b0_orig or 0))
                        ).to_integral_value(rounding=ROUND_HALF_UP)

                        eps_up = Decimal(str(sim_input.sensitivity_up or 0))
                        eps_down = Decimal(str(sim_input.sensitivity_down or 0))
                        eps = eps_down if db_dec < 0 else eps_up

                        if db_dec == 0:
                            continue

                        dd = compute_delta_riders(D0=d0_dec, B0=b0_dec, dB=db_dec, eps=eps)

                        rc, created = RidershipChange.objects.get_or_create(
                            simulation=sim,
                            simulation_input=sim_input,
                            route_id=route_id,
                            gtfs_service_id=sid,
                            defaults=dict(
                                baseline_riders_per_day=d0_dec,
                                baseline_trips_per_day=b0_dec,
                                delta_trips_per_day=db_dec,
                                sensitivity_epsilon=eps,
                                delta_riders_per_day=dd,
                                status="success",
                            ),
                        )
                        if not created:
                            rc.baseline_riders_per_day = d0_dec
                            rc.baseline_trips_per_day = b0_dec
                            rc.delta_trips_per_day = db_dec
                            rc.sensitivity_epsilon = eps
                            rc.delta_riders_per_day = dd
                            rc.status = "success"
                            rc.save(
                                update_fields=[
                                    "baseline_riders_per_day",
                                    "baseline_trips_per_day",
                                    "delta_trips_per_day",
                                    "sensitivity_epsilon",
                                    "delta_riders_per_day",
                                    "status",
                                    "updated_at",
                                ]
                            )

                        results.append(
                            {
                                "route_id": route_id,
                                "gtfs_service_id": sid,
                                "baseline_trips_per_day": b0_dec,
                                "baseline_riders_per_day": d0_dec,
                                "delta_trips_per_day": db_dec,
                                "delta_riders_per_day": dd,
                                "created": created,
                                "status": "success",
                                "trip_id": trip_id,
                            }
                        )
                    except Exception:
                        logger.exception(
                            "Failed to seed RidershipChange for route_id=%s service_id=%s",
                            route_id_raw,
                            sid,
                        )
                        results.append(
                            {
                                "route_id": route_id_raw,
                                "gtfs_service_id": sid,
                                "baseline_trips_per_day": Decimal("0"),
                                "baseline_riders_per_day": Decimal("0"),
                                "delta_trips_per_day": Decimal("0"),
                                "delta_riders_per_day": Decimal("0"),
                                "created": False,
                                "status": "error",
                                "trip_id": trip_id,
                            }
                        )
                        continue

        return results

    except Exception:
        logger.exception("Seeding ridership_change with deltas failed (ignored)")
        return results

