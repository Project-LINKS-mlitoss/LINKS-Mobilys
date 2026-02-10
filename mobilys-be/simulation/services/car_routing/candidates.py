from decimal import Decimal
from typing import Any, Dict, List, Optional

from simulation.services.base import log_service_call
from simulation.services.car_routing.candidates_helpers import (
    _car_route_for_shape,
    _filter_shapes_by_id,
    _get_route_meta_and_color,
    _get_shape_id_for_trip,
    _get_shapes_for_route,
    check_scenario_is_duplicated,
)

@log_service_call
def build_comparative_candidates(
    scenario_start: str,
    scenario_end: str,
    service_id: str,
    simulation1_result,
    *,
    limit_shapes_per_route: Optional[int] = None,
    prefer_bus: bool = False,
    bus_buffer_m: int = 30,
    csv_penalty_factor: float = 10.0,
) -> Dict[str, Any]:
    def _as_int(x) -> int:
        try:
            if isinstance(x, Decimal):
                return int(x)
            if x is None:
                return 0
            return int(round(float(x)))
        except Exception:
            return 0

    sim1_list: List[Dict[str, Any]] = []
    if isinstance(simulation1_result, list):
        sim1_list = simulation1_result
    elif isinstance(simulation1_result, dict):
        for key in ("routes", "data", "items", "result"):
            if isinstance(simulation1_result.get(key), list):
                sim1_list = simulation1_result[key]
                break

    items: List[Dict[str, Any]] = []

    if not sim1_list:
        return {
            "service_id": service_id,
            "scenario_start": str(scenario_start),
            "scenario_end": str(scenario_end),
            "routes_changed": 0,
            "routes": [],
        }
    else:
        for rec in sim1_list:
            rid = (rec or {}).get("route_id")
            if not rid:
                continue

            trips_start = _as_int((rec or {}).get("baseline_trips_per_day"))
            trips_delta = _as_int((rec or {}).get("delta_trips_per_day"))
            trips_end = trips_start + trips_delta

            meta_start = _get_route_meta_and_color(rid, scenario_start)
            meta_end = _get_route_meta_and_color(rid, scenario_end)
            color_hex = meta_start["color_hex"] or meta_end["color_hex"]

            trip_id = (rec or {}).get("trip_id")
            preferred_shape = _get_shape_id_for_trip(trip_id, scenario_start)

            shapes_s = _get_shapes_for_route(rid, scenario_start, service_id, limit_shapes_per_route)
            shapes_s = _filter_shapes_by_id(shapes_s, preferred_shape)
            start_shapes = []
            for s in shapes_s:
                car = _car_route_for_shape(
                    s, prefer_bus=prefer_bus, bus_buffer_m=bus_buffer_m,
                    csv_penalty_factor=csv_penalty_factor,
                )
                start_shapes.append({
                    "shape_id": s["shape_id"],
                    "trips_count": s["trips_count"],
                    "gtfs_shape": s["gtfs_shape"],
                    "start": s["start"], "end": s["end"],
                    "car_path": car,
                })

            shapes_e = _get_shapes_for_route(rid, scenario_end, service_id, limit_shapes_per_route)
            shapes_e = _filter_shapes_by_id(shapes_e, preferred_shape)
            end_shapes = []
            for s in shapes_e:
                car = _car_route_for_shape(
                    s, prefer_bus=prefer_bus, bus_buffer_m=bus_buffer_m,
                    csv_penalty_factor=csv_penalty_factor,
                )
                end_shapes.append({
                    "shape_id": s["shape_id"],
                    "trips_count": s["trips_count"],
                    "gtfs_shape": s["gtfs_shape"],
                    "start": s["start"], "end": s["end"],
                    "car_path": car,
                })

            items.append({
                "route_id": rid,
                "route_name_start": meta_start["route_name"],
                "route_name_end": meta_end["route_name"],
                "route_keyword_color": f"#{color_hex}",
                "trip_id": (rec or {}).get("trip_id"),
                "trips": {
                    "start": trips_start,
                    "end": trips_end,
                    "delta": trips_delta,
                },
                "scenarios": {
                    "start": {"id": str(scenario_start), "shapes": start_shapes},
                    "end": {"id": str(scenario_end), "shapes": end_shapes},
                },
            })

    return {
        "service_id": service_id,
        "scenario_start": str(scenario_start),
        "scenario_end": str(scenario_end),
        "routes_changed": len(items),
        "routes": items,
    }
