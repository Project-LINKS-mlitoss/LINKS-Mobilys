from typing import Any, Dict

from django.db import models

from simulation.models import SegmentSpeedMetrics, RidershipChange, OperatingEconomics, CO2Reduction
from simulation.services.base import log_service_call


class SimulationSummaryService:
    @staticmethod
    @log_service_call
    def get_summary(simulation_id: str) -> Dict[str, Any]:
        rc_qs = RidershipChange.objects.filter(simulation_id=simulation_id).exclude(delta_trips_per_day=0)
        route_ids = rc_qs.values_list("route_id", flat=True).distinct()

        routes = []
        totals = {
            "total_baseline_riders_per_day": 0,
            "total_baseline_trips_per_day": 0,
            "total_delta_trips_per_day": 0,
            "total_delta_riders_per_day": 0,
            "total_after_riders_per_day": 0,
            "total_after_trips_per_day": 0,
        }

        for route_id in route_ids:
            route_data = list(rc_qs.filter(route_id=route_id).values())
            sum_baseline_riders = sum(float(r.get("baseline_riders_per_day", 0)) for r in route_data)
            sum_baseline_trips = sum(float(r.get("baseline_trips_per_day", 0)) for r in route_data)
            sum_delta_trips = sum(float(r.get("delta_trips_per_day", 0)) for r in route_data)
            sum_delta_riders = sum(
                float(r.get("delta_riders_per_day", 0))
                for r in route_data
                if r.get("delta_riders_per_day") is not None
            )
            sum_after_riders_per_day = sum_baseline_riders + sum_delta_riders if sum_delta_riders is not None else None
            sum_after_trips_per_day = sum_baseline_trips + sum_delta_trips

            routes.append({
                "route_id": route_id,
                "data": route_data,
                "sum_baseline_riders_per_day": sum_baseline_riders,
                "sum_baseline_trips_per_day": sum_baseline_trips,
                "sum_delta_trips_per_day": sum_delta_trips,
                "sum_delta_riders_per_day": sum_delta_riders,
                "sum_after_riders_per_day": sum_after_riders_per_day,
                "sum_after_trips_per_day": sum_after_trips_per_day,
            })

            totals["total_baseline_riders_per_day"] += sum_baseline_riders
            totals["total_baseline_trips_per_day"] += sum_baseline_trips
            totals["total_delta_trips_per_day"] += sum_delta_trips
            totals["total_delta_riders_per_day"] += sum_delta_riders
            totals["total_after_riders_per_day"] += sum_after_riders_per_day
            totals["total_after_trips_per_day"] += sum_after_trips_per_day

        simulation_1_data = {
            "routes": routes,
            "totals": totals,
        }

        ops_qs = OperatingEconomics.objects.filter(simulation_id=simulation_id)
        route_ids = ops_qs.values_list("route_id", flat=True).distinct()

        routes = []
        total_annual_benefit_k_yen = 0

        for route_id in route_ids:
            route_data = list(ops_qs.filter(route_id=route_id).values())
            sum_annual_benefit = sum(float(r.get("annual_benefit_k_yen", 0) or 0) for r in route_data)
            routes.append({
                "route_id": route_id,
                "data": route_data,
                "sum_annual_benefit_k_yen": sum_annual_benefit,
            })
            total_annual_benefit_k_yen += sum_annual_benefit

        simulation_2_data = {
            "routes": routes,
            "totals": {
                "total_annual_benefit_k_yen": total_annual_benefit_k_yen,
            },
        }

        metrics_qs = SegmentSpeedMetrics.objects.filter(simulation_id=simulation_id)
        route_ids = metrics_qs.values_list("route_id", flat=True).distinct()

        segment_speed_routes = []
        segment_speed_totals = {
            "speed_before_kmh": 0,
            "speed_after_kmh": 0,
            "time_per_vehicle_before_h": 0,
            "time_per_vehicle_after_h": 0,
            "total_time_before_vehicle_h": 0,
            "total_time_after_vehicle_h": 0,
        }

        for route_id in route_ids:
            route_metrics = metrics_qs.filter(route_id=route_id)
            route_obj = {
                "route_id": route_id,
                "speed_before_kmh": float(route_metrics.aggregate(models.Sum("speed_before_kmh"))["speed_before_kmh__sum"] or 0),
                "speed_after_kmh": float(route_metrics.aggregate(models.Sum("speed_after_kmh"))["speed_after_kmh__sum"] or 0),
                "time_per_vehicle_before_h": float(route_metrics.aggregate(models.Sum("time_per_vehicle_before_h"))["time_per_vehicle_before_h__sum"] or 0),
                "time_per_vehicle_after_h": float(route_metrics.aggregate(models.Sum("time_per_vehicle_after_h"))["time_per_vehicle_after_h__sum"] or 0),
                "total_time_before_vehicle_h": float(route_metrics.aggregate(models.Sum("total_time_before_vehicle_h"))["total_time_before_vehicle_h__sum"] or 0),
                "total_time_after_vehicle_h": float(route_metrics.aggregate(models.Sum("total_time_after_vehicle_h"))["total_time_after_vehicle_h__sum"] or 0),
            }
            for k in segment_speed_totals:
                segment_speed_totals[k] += route_obj[k]
            segment_speed_routes.append(route_obj)

        segment_speed_metrics_data = {
            "routes": segment_speed_routes,
            "totals": segment_speed_totals,
        }

        co2_qs = CO2Reduction.objects.filter(simulation_id=simulation_id)
        route_ids = co2_qs.values_list("route_id", flat=True).distinct()

        routes = []
        total_co2_before_per_year = 0
        total_co2_after_per_year = 0
        total_co2_reduction_per_year = 0

        for route_id in route_ids:
            route_data = co2_qs.filter(route_id=route_id)
            first = route_data.first()
            vkt_before = float(first.vkt_before_km_day or 0)
            vkt_after = float(first.vkt_after_km_day or 0)
            co2_tons = float(first.co2_tons_per_year or 0)

            route_obj = {
                "route_id": route_id,
                "simulation_input_id": first.simulation_input_id,
                "vkt_before_km_day": vkt_before,
                "vkt_after_km_day": vkt_after,
                "co2_tons_per_year": co2_tons,
                "co2_before_per_year": vkt_before * 365,
                "co2_after_per_year": vkt_after * 365,
            }
            routes.append(route_obj)

            total_co2_before_per_year += vkt_before * 365
            total_co2_after_per_year += vkt_after * 365
            total_co2_reduction_per_year += co2_tons

        co2_reduction_data = {
            "routes": routes,
            "totals": {
                "total_co2_before_per_year": total_co2_before_per_year,
                "total_co2_after_per_year": total_co2_after_per_year,
                "total_co2_reduction_per_year": total_co2_reduction_per_year,
            },
        }

        payload = {
            "ridership_change_data": simulation_1_data,
            "operating_economics_data": simulation_2_data,
            "segment_speed_metrics_data": segment_speed_metrics_data,
            "co2_reduction": co2_reduction_data,
        }

        return payload
