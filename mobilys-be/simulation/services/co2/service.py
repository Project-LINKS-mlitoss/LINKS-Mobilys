# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from django.db.models import Sum, Avg
from django.db.models.functions import Coalesce
from simulation.models import CO2Reduction
from simulation.services.base import log_service_call
from simulation.utils.decimals import round1
from simulation.utils.string import sort_key_casefold


class CO2Service:
    @staticmethod
    @log_service_call
    def list_queryset(user, simulation_id: str, simulation_input_id: Optional[str] = None):
        qs = (
            CO2Reduction.objects
            .select_related("simulation__original_scenario")
            .order_by("route_id")
        )
        if user is not None:
            qs = qs.filter(simulation__original_scenario__user=user)
        if not simulation_id:
            return qs.none()
        qs = qs.filter(simulation_id=simulation_id)
        if simulation_input_id:
            qs = qs.filter(simulation_input_id=simulation_input_id)
        return qs

    @staticmethod
    def get_queryset(simulation_id: str, simulation_input_id: Optional[str] = None):
        qs = CO2Reduction.objects.filter(simulation_id=simulation_id)
        if simulation_input_id:
            qs = qs.filter(simulation_input_id=simulation_input_id)
        return qs

    @staticmethod
    @log_service_call
    def get_patterns(
        simulation_id: str,
        simulation_input_id: Optional[str] = None,
        service_ids_param: Optional[str] = None,
    ) -> Dict[str, Any]:
        co2_qs = CO2Reduction.objects.filter(simulation_id=simulation_id)
        if simulation_input_id:
            co2_qs = co2_qs.filter(simulation_input_id=simulation_input_id)

        if service_ids_param:
            target_sids = [s.strip() for s in service_ids_param.split(",") if s.strip()]
            co2_qs = co2_qs.filter(service_id__in=target_sids)
        else:
            target_sids = list(
                co2_qs.exclude(service_id__isnull=True)
                    .exclude(service_id__exact="")
                    .values_list("service_id", flat=True)
                    .distinct()
            )

        sids_by_route = {}
        for rid, sid in co2_qs.values_list("route_id", "service_id"):
            sids_by_route.setdefault(rid, set()).add(sid)

        route_ids = sorted(sids_by_route.keys(), key=sort_key_casefold)
        if not route_ids or not target_sids:
            return {
                "simulation": simulation_id,
                "simulation_input": simulation_input_id,
                "service_ids": target_sids,
                "routes": [],
            }

        co2_map = {}
        for r in co2_qs.order_by("route_id", "service_id", "-id"):
            k = (r.route_id, r.service_id)
            if k not in co2_map:
                co2_map[k] = r

        out_routes = []
        for rid in route_ids:
            sids_for_route = sorted(
                (sids_by_route.get(rid) or set()) & set(target_sids),
                key=sort_key_casefold,
            )
            for sid in sids_for_route:
                co2_obj = co2_map.get((rid, sid))
                co2_data = co2_obj

                out_routes.append({
                    "route_id": rid,
                    "service_id": sid,
                    "co2_reduction": co2_data,
                })

        return {
            "simulation": simulation_id,
            "simulation_input": simulation_input_id,
            "service_ids": sorted(set(target_sids), key=sort_key_casefold),
            "routes": out_routes,
        }

    @staticmethod
    @log_service_call
    def get_totals(simulation_id: str, simulation_input_id: Optional[str] = None) -> Dict[str, Any]:
        qs = CO2Reduction.objects.filter(simulation_id=simulation_id)
        if simulation_input_id:
            qs = qs.filter(simulation_input_id=simulation_input_id)

        agg = qs.aggregate(
            vkt_before=Coalesce(Sum("vkt_before_km_day"), Decimal("0")),
            vkt_after=Coalesce(Sum("vkt_after_km_day"), Decimal("0")),
            delta_vkt=Coalesce(Sum("delta_vkt_km_day"), Decimal("0")),
            ef_car=Avg("ef_car_g_per_vkm"),
            co2_total=Coalesce(Sum("co2_tons_per_year"), Decimal("0")),
        )

        return {
            "simulation": int(simulation_id),
            "vkt_before_km_day": float(round1(agg["vkt_before"])),
            "vkt_after_km_day": float(round1(agg["vkt_after"])),
            "delta_vkt_km_day": float(round1(agg["delta_vkt"])),
            "ef_car_g_per_vkm": float(round1(Decimal(str(agg["ef_car"] or 0)))),
            "co2_tons_per_year": float(round1(agg["co2_total"])),
        }
