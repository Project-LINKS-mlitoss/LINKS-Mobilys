# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging
from typing import Any, Dict, List, Tuple

from django.db import IntegrityError

from gtfs.models import Calendar, CalendarDates
from simulation.models import Simulation, SimulationInput
from simulation.services.base import ValidationError, log_service_call, transactional
from simulation.services.benefit_calculations_service import compute_benefits_from_payload
from simulation.services.car_routing_service import build_comparative_candidates, build_segment_volume_changes
from simulation.services.co2_service import co2_calc_and_persist_routewise as co2_calc_and_persist
from simulation.services.operating_economics_service import operating_economics_calc
from simulation.services.ridership_change_service import _seed_ridership_changes
from simulation.services.simulation_init.csv_utils import _build_ic_agg_from_csv
from simulation.services.simulation_service import SimulationService
from simulation.services.travel_speed_changes_service import travel_speed_calc

logger = logging.getLogger(__name__)

def _validate_service_ids_for_date(sim: Simulation, d, service_ids: List[str]) -> Tuple[bool, List[str]]:
    scenario_ids = [sid for sid in [sim.original_scenario_id, sim.duplicated_scenario_id] if sid]
    weekday_fields = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    weekday_field = weekday_fields[d.weekday()]

    rows = (
        Calendar.objects
        .filter(
            scenario__in=scenario_ids,
            start_date__lte=d,
            end_date__gte=d,
            **{weekday_field: 1},
        )
        .values_list("service_id", flat=True)
    )
    active = set(rows)
    for ex in CalendarDates.objects.filter(scenario__in=scenario_ids, date=d):
        if ex.exception_type == 1:
            active.add(ex.service_id)
        elif ex.exception_type == 2 and ex.service_id in active:
            active.remove(ex.service_id)

    invalid = [s for s in service_ids if s not in active]
    return (len(invalid) == 0, invalid)


class SimulationInitService:
    @staticmethod
    @log_service_call
    @transactional
    def initialize(
        *,
        simulation_id: str,
        service_date,
        service_ids: List[str],
        sensitivity_up: float,
        sensitivity_down: float,
        trip_cost: float,
        car_share: float,
        time_value: float,
        default_fare: float,
        file_obj,
        source_file_name: str,
        source_file_size: int,
        source_file_type: str,
        prefer_bus: bool = False,
        bus_buffer_m: int = 10,
        csv_penalty_factor: float = 10.0,
    ) -> tuple[Simulation, SimulationInput]:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario", "duplicated_scenario"),
            for_update=True,
            not_found_message="simulation_not_found",
            not_found_code="simulation_not_found",
        )

        if SimulationInput.objects.filter(simulation_id=sim.id).exists():
            raise ValidationError(message="already_exists", code="already_exists")

        ok, invalid = _validate_service_ids_for_date(sim, service_date, service_ids)
        if not ok:
            raise ValidationError(
                message="invalid_service_id_for_date",
                code="invalid_service_id_for_date",
                details={"invalid": invalid},
            )

        try:
            sim_input = SimulationInput.objects.create(
                simulation=sim,
                service_date=service_date,
                service_id=",".join(service_ids),
                sensitivity_up=sensitivity_up,
                sensitivity_down=sensitivity_down,
                trip_cost=trip_cost,
                car_share=car_share,
                time_value_yen_per_min_per_vehicle=time_value,
                default_fare=default_fare,
                source_file_name=source_file_name,
                source_file_size=source_file_size,
                source_file_type=source_file_type,
                status="processing",
            )
        except IntegrityError:
            raise ValidationError(message="already_exists", code="already_exists")

        ic_agg = _build_ic_agg_from_csv(file_obj, scenario=sim.original_scenario) if file_obj else None
        if ic_agg is not None:
            sim_input.ic_agg = ic_agg
            sim_input.save(update_fields=["ic_agg"])

        any_seeded = False

        for sid in service_ids:
            try:
                sim1_sid = _seed_ridership_changes(
                    sim_input,
                    service_ids=[sid],
                    date=service_date,
                )

                if not sim1_sid:
                    continue

                any_seeded = True

                items = [{
                    "simulation": str(sim_input.simulation_id),
                    "route_id": rc.get("route_id"),
                    "delta_trips_per_day": float(rc.get("delta_trips_per_day") or 0),
                    "delta_users_per_day": float(rc.get("delta_riders_per_day") or 0),
                    "cost_per_vkm_yen": float(trip_cost),
                    "service_id": sid,
                } for rc in sim1_sid]

                operating_economics_calc(
                    items,
                    simulation_input=sim_input,
                    default_service_id=sid,
                    default_fare=default_fare,
                )

                simulation_3_result = build_comparative_candidates(
                    scenario_start=sim.original_scenario.id,
                    scenario_end=sim.duplicated_scenario.id,
                    service_id=sid,
                    simulation1_result=sim1_sid,
                    prefer_bus=prefer_bus,
                    bus_buffer_m=bus_buffer_m,
                    csv_penalty_factor=csv_penalty_factor,
                )

                simulation_4_result = build_segment_volume_changes(
                    sim3_results=simulation_3_result,
                    automobile_share=car_share,
                    sim1_result=sim1_sid,
                    persist=True,
                    simulation=sim.id,
                    simulation_input=sim_input.id,
                )

                simulation_5_result = travel_speed_calc(
                    simulation_id=sim.id,
                    data4=simulation_4_result,
                    simulation_input=sim_input,
                )

                compute_benefits_from_payload(
                    payload=simulation_5_result,
                    time_value_unit_yen_per_minute_per_vehicle=time_value,
                    simulation_input=sim_input,
                )

                co2_calc_and_persist(
                    simulation=sim.id,
                    simulation_input=sim_input.id,
                    ef_car_g_per_vkm=127,
                )

            except Exception:
                logger.exception("Pipeline failed for service_id=%s", sid)
                continue

        if not any_seeded:
            raise ValidationError(message="no_different_data", code="no_different_data")

        sim_input.status = "success"
        sim_input.save(update_fields=["status", "updated_at"])

        return sim, sim_input
