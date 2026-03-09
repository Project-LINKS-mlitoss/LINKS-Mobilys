# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Any, Dict

from django.db import transaction

from simulation.models import SegmentSpeedMetrics, Simulation
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService
from simulation.services.travel_speed_changes.calculator import compute_speed_time_nested_response


def _get_owned_simulation(simulation_id) -> Simulation:
    sim = SimulationService.find_simulation(
        simulation_id,
        select_related=("original_scenario",),
    )
    if not sim:
        raise Simulation.DoesNotExist("Simulation not found")
    return sim


@log_service_call
@transaction.atomic
def travel_speed_calc(
    simulation_id: str,
    data4: Dict[str, Any],
    simulation_input,
    *,
    overwrite: bool = False,
) -> Dict[str, Any]:
    """
    Compute & persist the six segment metrics, then return the nested payload.
    """
    sim = _get_owned_simulation(simulation_id)

    result = compute_speed_time_nested_response(data4)
    service_id = result.get("service_id")
    for route in result.get("routes", []):
        route_id = route.get("route_id", "")
        for shape in route.get("shapes", []):
            shape_id = shape.get("shape_id", "")
            direction_id = shape.get("direction_id", "")
            for seg in shape.get("segments", []):
                metrics = seg.get("metrics", {})
                speed = metrics.get("speed_kmh", {})
                tper = metrics.get("time_per_vehicle_h", {})
                ttot = metrics.get("total_time_vehicle_h", {})

                defaults = dict(
                    section_code_csv=seg.get("section_code_csv"),
                    road_name=seg.get("road_name"),
                    speed_before_kmh=float(speed.get("before", 0.0)),
                    speed_after_kmh=float(speed.get("after", 0.0)),
                    time_per_vehicle_before_h=float(tper.get("before", 0.0)),
                    time_per_vehicle_after_h=float(tper.get("after", 0.0)),
                    total_time_before_vehicle_h=float(ttot.get("before", 0.0)),
                    total_time_after_vehicle_h=float(ttot.get("after", 0.0)),
                )

                if overwrite:
                    SegmentSpeedMetrics.objects.update_or_create(
                        simulation=sim,
                        route_id=route_id,
                        shape_id=shape_id,
                        direction_id=direction_id,
                        service_id=service_id,
                        matchcode_shp=seg.get("matchcode_shp"),
                        defaults=defaults,
                        simulation_input_id=simulation_input.id,
                    )
                else:
                    SegmentSpeedMetrics.objects.create(
                        simulation=sim,
                        route_id=route_id,
                        shape_id=shape_id,
                        direction_id=direction_id,
                        service_id=service_id,
                        matchcode_shp=seg.get("matchcode_shp"),
                        **defaults,
                        simulation_input_id=simulation_input.id,
                    )

    return {
        "simulation": str(sim.id),
        "car_change_number": float(data4.get("car_change_number", 0.0)),
        **result,
    }
