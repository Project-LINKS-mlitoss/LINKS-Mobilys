# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from gtfs.models import Routes, Shape, StopTimes, Stops, Trips
from gtfs.utils.route_data_utils import RouteDataUtils
from simulation.models import SegmentSpeedMetrics
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService


class SegmentSpeedMetricsService:
    @staticmethod
    @log_service_call
    def get_payload(
        simulation_id: str,
        service_id: Optional[str] = None,
        car_change_number: Optional[float] = None,
    ) -> Dict[str, Any]:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario",),
            not_found_message=f"Simulation {simulation_id} not found or not accessible.",
        )

        qs = (
            SegmentSpeedMetrics.objects
            .filter(simulation=sim)
            .order_by("route_id", "shape_id", "direction_id", "id")
        )

        scenario_id = getattr(sim, "original_scenario_id", None)
        route_patterns = []
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
        shapes_map_per_route: Dict[str, Dict[Tuple[str, int, Optional[str]], Dict[str, Any]]] = defaultdict(dict)

        top_service_id: Optional[str] = service_id

        for row in qs.iterator():
            r_id = row.route_id or ""
            s_id = row.shape_id or ""
            dir_id: Optional[int] = row.direction_id if row.direction_id is not None else None
            svc_id = row.service_id or None

            if r_id not in routes_map:
                routes_map[r_id] = {"route_id": r_id, "service_id": svc_id, "shapes": []}
            elif routes_map[r_id]["service_id"] is None and svc_id:
                routes_map[r_id]["service_id"] = svc_id

            shape_key = (s_id, (dir_id if dir_id is not None else -1), svc_id)

            route_shapes = shapes_map_per_route[r_id]
            if shape_key not in route_shapes:
                pattern_obj = pattern_index.get((r_id, s_id, dir_id, svc_id)) or {}

                shp = {
                    "route_pattern": pattern_obj,
                    "direction_id": dir_id,
                    "service_id": svc_id,
                    "segments": [],
                }
                route_shapes[shape_key] = shp
                routes_map[r_id]["shapes"].append(shp)

            seg = {
                "matchcode_shp": row.matchcode_shp,
                "section_code_csv": row.section_code_csv,
                "road_name": row.road_name,
                "metrics": {
                    "speed_kmh": {
                        "before": float(row.speed_before_kmh) if row.speed_before_kmh is not None else None,
                        "after": float(row.speed_after_kmh) if row.speed_after_kmh is not None else None,
                    },
                    "time_per_vehicle_h": {
                        "before": float(row.time_per_vehicle_before_h) if row.time_per_vehicle_before_h is not None else None,
                        "after": float(row.time_per_vehicle_after_h) if row.time_per_vehicle_after_h is not None else None,
                    },
                    "total_time_vehicle_h": {
                        "before": float(row.total_time_before_vehicle_h) if row.total_time_before_vehicle_h is not None else None,
                        "after": float(row.total_time_after_vehicle_h) if row.total_time_after_vehicle_h is not None else None,
                    },
                },
            }
            route_shapes[shape_key]["segments"].append(seg)

        routes: List[Dict[str, Any]] = list(routes_map.values())

        payload: Dict[str, Any] = {
            "simulation": str(sim.id),
            "car_change_number": car_change_number,
            "service_id": top_service_id,
            "routes": routes,
        }
        return payload
