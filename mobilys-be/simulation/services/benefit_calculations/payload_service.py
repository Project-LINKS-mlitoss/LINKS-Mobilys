# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from gtfs.models import Routes, Trips, StopTimes, Stops, Shape
from gtfs.utils.route_data_utils import RouteDataUtils
from simulation.models import BenefitCalculations
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService
from simulation.utils.number import round0
from simulation.utils.decimals import to_decimal0

class BenefitCalculationsService:
    @staticmethod
    @log_service_call
    def get_payload(simulation_id: str) -> Dict[str, Any]:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario",),
            not_found_message=f"Simulation {simulation_id} not found or not accessible.",
        )

        qs = (
            BenefitCalculations.objects
            .filter(simulation_id=sim.id)
            .order_by("route_id", "shape_id", "direction_id", "id")
        )

        scenario_id = getattr(sim, "original_scenario_id", None)
        route_patterns: List[Dict[str, Any]] = []

        if scenario_id:
            all_routes = Routes.objects.filter(scenario_id=scenario_id)
            all_trips = Trips.objects.filter(scenario_id=scenario_id)
            all_stop_times = StopTimes.objects.filter(scenario_id=scenario_id)
            all_stops = Stops.objects.filter(scenario_id=scenario_id)
            all_shapes = Shape.objects.filter(scenario_id=scenario_id)
            route_patterns = RouteDataUtils.get_route_pattern(
                all_routes, all_trips, all_stop_times, all_stops, all_shapes
            )

        pattern_index: Dict[Tuple[str, str, Optional[int], Optional[str]], Dict[str, Any]] = {}
        for rp in route_patterns or []:
            rid = rp.get("route_id")
            for pat in rp.get("patterns", []):
                key = (rid, pat.get("shape_id"), pat.get("direction_id"), pat.get("service_id"))
                pattern_index[key] = pat

        routes_map: Dict[str, Dict[str, Any]] = {}
        shapes_map_per_route: Dict[
            str, Dict[Tuple[str, Optional[int], Optional[str]], Dict[str, Any]]
        ] = defaultdict(dict)

        sum_time_before = Decimal("0")
        sum_time_after = Decimal("0")
        sum_op_before = Decimal("0")
        sum_op_after = Decimal("0")
        sum_acc_before = Decimal("0")
        sum_acc_after = Decimal("0")

        top_service_id: Optional[str] = None

        for row in qs.iterator():
            r_id = row.route_id or ""
            s_id = row.shape_id or ""
            dir_id: Optional[int] = row.direction_id if row.direction_id is not None else None
            svc_id = row.service_id or None

            if top_service_id is None and svc_id:
                top_service_id = svc_id

            if r_id not in routes_map:
                routes_map[r_id] = {"route_id": r_id, "shapes": []}

            shape_key = (s_id, dir_id, svc_id)
            if shape_key not in shapes_map_per_route[r_id]:
                pat = pattern_index.get((r_id, s_id, dir_id, svc_id)) or {}
                shp = {
                    "route_pattern": pat,
                    "direction_id": dir_id,
                    "service_id": svc_id,
                    "segments": [],
                }
                shapes_map_per_route[r_id][shape_key] = shp
                routes_map[r_id]["shapes"].append(shp)

            seg = {
                "matchcode_shp": row.matchcode_shp,
                "section_code_csv": row.section_code_csv,
                "road_name": row.road_name,
                "metrics": {
                    "travel_time_savings_benefit_yen_per_year": {
                        "before": float(row.travel_time_savings_before or 0),
                        "after": float(row.travel_time_savings_after or 0),
                    },
                    "operating_cost_reduction_benefit_yen_per_year": {
                        "before": float(row.operating_cost_reduction_before or 0),
                        "after": float(row.operating_cost_reduction_after or 0),
                    },
                    "traffic_accident_reduction_benefit_yen_per_year": {
                        "before": float(row.traffic_accident_reduction_before or 0),
                        "after": float(row.traffic_accident_reduction_after or 0),
                    },
                },
            }
            shapes_map_per_route[r_id][shape_key]["segments"].append(seg)

            sum_time_before += to_decimal0(row.travel_time_savings_before)
            sum_time_after += to_decimal0(row.travel_time_savings_after)
            sum_op_before += to_decimal0(row.operating_cost_reduction_before)
            sum_op_after += to_decimal0(row.operating_cost_reduction_after)
            sum_acc_before += to_decimal0(row.traffic_accident_reduction_before)
            sum_acc_after += to_decimal0(row.traffic_accident_reduction_after)

        routes: List[Dict[str, Any]] = list(routes_map.values())

        totals = {
            "total_travel_time_savings_benefit_before_per_year": round0(sum_time_before),
            "total_travel_time_savings_benefit_after_per_year": round0(sum_time_after),
            "total_operating_cost_reduction_benefit_before_per_year": round0(sum_op_before),
            "total_operating_cost_reduction_benefit_after_per_year": round0(sum_op_after),
            "total_traffic_accident_reduction_benefit_before_per_year": round0(sum_acc_before),
            "total_traffic_accident_reduction_benefit_after_per_year": round0(sum_acc_after),
        }

        annual_benefits = {
            "annual_travel_time_savings_benefit": (
                totals["total_travel_time_savings_benefit_before_per_year"]
                - totals["total_travel_time_savings_benefit_after_per_year"]
            )*365,
            "annual_operating_cost_reduction_benefit": (
                totals["total_operating_cost_reduction_benefit_before_per_year"]
                - totals["total_operating_cost_reduction_benefit_after_per_year"]
            )*365,
            "annual_traffic_accident_reduction_benefit": (
                totals["total_traffic_accident_reduction_benefit_before_per_year"]
                - totals["total_traffic_accident_reduction_benefit_after_per_year"]
            ),
        }

        annual_total_benefit = round(
            annual_benefits["annual_travel_time_savings_benefit"]
            + annual_benefits["annual_operating_cost_reduction_benefit"]
            + annual_benefits["annual_traffic_accident_reduction_benefit"],
            0,
        )

        return {
            "simulation": str(sim.id),
            "service_id": top_service_id or "",
            "routes": routes,
            "totals": totals,
            "annual_benefits": annual_benefits,
            "annual_total_benefit": annual_total_benefit,
        }
