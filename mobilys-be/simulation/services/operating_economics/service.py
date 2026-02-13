# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Any, Dict, Optional
from simulation.models import OperatingEconomics
from simulation.services.base import log_service_call
from simulation.utils.string import sort_key_casefold

class OperatingEconomicsService:
    @staticmethod
    @log_service_call
    def list_queryset():
        return (
            OperatingEconomics.objects
            .select_related("simulation__original_scenario")
            .order_by("id")
        )

    @staticmethod
    @log_service_call
    def get_patterns(
        simulation_id: str,
        simulation_input_id: Optional[str] = None,
        service_ids_param: Optional[str] = None,
    ) -> Dict[str, Any]:
        oe_qs = OperatingEconomics.objects.filter(simulation_id=simulation_id)
        if simulation_input_id:
            oe_qs = oe_qs.filter(simulation_input_id=simulation_input_id)

        if service_ids_param:
            target_sids = [s.strip() for s in service_ids_param.split(",") if s.strip()]
            oe_qs = oe_qs.filter(service_id__in=target_sids)
        else:
            target_sids = list(
                oe_qs.exclude(service_id__isnull=True)
                    .exclude(service_id__exact="")
                    .values_list("service_id", flat=True)
                    .distinct()
            )

        oe_sids_by_route = {}
        for rid, sid in oe_qs.values_list("route_id", "service_id"):
            oe_sids_by_route.setdefault(rid, set()).add(sid)

        route_ids = sorted(oe_sids_by_route.keys(), key=sort_key_casefold)
        if not route_ids or not target_sids:
            return {
                "simulation": simulation_id,
                "service_ids": target_sids,
                "routes": [],
            }

        oe_map = {}
        for r in oe_qs.order_by("route_id", "service_id", "-id"):
            k = (r.route_id, r.service_id)
            if k not in oe_map:
                oe_map[k] = r

        out_routes = []
        for rid in route_ids:
            sids_for_route = sorted(
                (oe_sids_by_route.get(rid) or set()) & set(target_sids),
                key=sort_key_casefold,
            )
            for sid in sids_for_route:
                oe = oe_map.get((rid, sid))
                oe_data = oe

                out_routes.append({
                    "route_id": rid,
                    "service_id": sid,
                    "operating_economics": oe_data,
                })

        return {
            "simulation": simulation_id,
            "simulation_input": simulation_input_id,
            "service_ids": sorted(set(target_sids), key=sort_key_casefold),
            "routes": out_routes,
        }
