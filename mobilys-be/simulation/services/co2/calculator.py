# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.db import transaction
from django.db.models import Sum, F, DecimalField, ExpressionWrapper

from simulation.models import Simulation, CarRouting, CarRoutingSegment, CO2Reduction
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService
from simulation.utils.decimals import round1, to_decimal


def _model_has_field(model, name: str) -> bool:
    return any(f.name == name for f in model._meta.fields)


def aggregate_totals_from_rows(
    rows: list[dict],
    *,
    ef_car_g_per_vkm: float | int = 127,
) -> dict:
    ef = to_decimal(ef_car_g_per_vkm, "127")
    total_before = Decimal("0")
    total_after = Decimal("0")
    for r in rows or []:
        vb = to_decimal(r.get("vkt_before_km_day"), "0")
        va = to_decimal(r.get("vkt_after_km_day"), "0")
        total_before += vb
        total_after += va
    delta = total_before - total_after
    co2_t = (delta * ef * Decimal("365")) / Decimal("1000000")
    return {
        "vkt_before_km_day": float(round1(total_before)),
        "vkt_after_km_day": float(round1(total_after)),
        "delta_vkt_km_day": float(round1(delta)),
        "co2_tons_per_year": float(round1(co2_t)),
        "ef_car_g_per_vkm": float(ef),
    }


@log_service_call
@transaction.atomic
def co2_calc_and_persist_routewise(
    *,
    simulation: int | str,
    simulation_input: Optional[int | str] = None,
    ef_car_g_per_vkm: float | int = 127,
) -> Dict[str, Any]:
    sim = SimulationService.find_simulation(simulation)
    if sim is None:
        raise Simulation.DoesNotExist("Simulation matching query does not exist.")
    ef = to_decimal(ef_car_g_per_vkm, "127")

    cr_filter = {"simulation": sim}
    if simulation_input:
        cr_filter["simulation_input_id"] = simulation_input

    routing_ids = list(CarRouting.objects.filter(**cr_filter).values_list("id", flat=True))
    if not routing_ids:
        payload = {
            "simulation": sim.id,
            "simulation_input": simulation_input or None,
            "ef_car_g_per_vkm": float(ef),
            "routes": [],
            "totals": {
                "vkt_before_km_day": 0.0,
                "vkt_after_km_day": 0.0,
                "delta_vkt_km_day": 0.0,
                "co2_tons_per_year": 0.0,
            },
        }
        try:
            obj, _ = CO2Reduction.objects.get_or_create(
                simulation=sim, simulation_input_id=simulation_input
            )
            obj.vkt_before_km_day = Decimal("0")
            obj.vkt_after_km_day = Decimal("0")
            obj.delta_vkt_km_day = Decimal("0")
            obj.ef_car_g_per_vkm = ef
            obj.co2_tons_per_year = Decimal("0")
            obj.status = "success"
            obj.save()
        except Exception:
            pass
        return payload

    km_expr = ExpressionWrapper(
        F("length_m") / Decimal("1000.0"),
        output_field=DecimalField(max_digits=20, decimal_places=6),
    )
    before_vkt_expr = ExpressionWrapper(
        F("baseline_cars_per_day") * km_expr,
        output_field=DecimalField(max_digits=28, decimal_places=6),
    )
    after_vkt_expr = ExpressionWrapper(
        F("after_cars_per_day") * km_expr,
        output_field=DecimalField(max_digits=28, decimal_places=6),
    )

    has_cr_sid = _model_has_field(CarRouting, "service_id")
    has_seg_sid = _model_has_field(CarRoutingSegment, "service_id")

    base_qs = CarRoutingSegment.objects.filter(car_routing_id__in=routing_ids)
    if has_cr_sid:
        per_key_values = base_qs.values(
            route_id=F("car_routing__route_id"),
            service_id=F("car_routing__service_id"),
        )
        order_by = ("car_routing__route_id", "car_routing__service_id")
    elif has_seg_sid:
        per_key_values = base_qs.values(
            route_id=F("car_routing__route_id"),
            service_id=F("service_id"),
        )
        order_by = ("car_routing__route_id", "service_id")
    else:
        per_key_values = base_qs.values(
            route_id=F("car_routing__route_id"),
        )
        order_by = ("car_routing__route_id",)

    per_route = (
        per_key_values
        .annotate(
            vkt_before=Sum(before_vkt_expr),
            vkt_after=Sum(after_vkt_expr),
        )
        .order_by(*order_by)
    )

    rows: List[Dict[str, Any]] = []
    total_before = Decimal("0")
    total_after = Decimal("0")

    has_co2_route = _model_has_field(CO2Reduction, "route_id")
    has_co2_sid = _model_has_field(CO2Reduction, "service_id")

    for r in per_route:
        route_id = str(r.get("route_id") or "")
        svc = (r.get("service_id") or "") if ("service_id" in r) else ""

        vkt_before = to_decimal(r.get("vkt_before"), "0")
        vkt_after = to_decimal(r.get("vkt_after"), "0")
        delta_vkt = vkt_before - vkt_after
        co2_t = (delta_vkt * ef * Decimal("365")) / Decimal("1000000")

        total_before += vkt_before
        total_after += vkt_after

        rows.append({
            "route_id": route_id,
            "service_id": svc,
            "vkt_before_km_day": float(round1(vkt_before)),
            "vkt_after_km_day": float(round1(vkt_after)),
            "delta_vkt_km_day": float(round1(delta_vkt)),
            "ef_car_g_per_vkm": float(ef),
            "co2_tons_per_year": float(round1(co2_t)),
        })

        if has_co2_route and has_co2_sid:
            obj, _ = CO2Reduction.objects.get_or_create(
                simulation=sim,
                simulation_input_id=simulation_input,
                route_id=route_id,
                service_id=svc,
            )
        elif has_co2_route:
            obj, _ = CO2Reduction.objects.get_or_create(
                simulation=sim,
                simulation_input_id=simulation_input,
                route_id=route_id,
            )
        else:
            obj = None

        if obj is not None:
            obj.vkt_before_km_day = round1(vkt_before)
            obj.vkt_after_km_day = round1(vkt_after)
            obj.delta_vkt_km_day = round1(delta_vkt)
            obj.ef_car_g_per_vkm = ef
            obj.co2_tons_per_year = round1(co2_t)
            obj.status = "success"
            obj.save()

    delta_total = total_before - total_after
    co2_total_t = (delta_total * ef * Decimal("365")) / Decimal("1000000")

    if not has_co2_route:
        obj, _ = CO2Reduction.objects.get_or_create(
            simulation=sim, simulation_input_id=simulation_input
        )
        obj.vkt_before_km_day = round1(total_before)
        obj.vkt_after_km_day = round1(total_after)
        obj.delta_vkt_km_day = round1(delta_total)
        obj.ef_car_g_per_vkm = ef
        obj.co2_tons_per_year = round1(co2_total_t)
        obj.status = "success"
        obj.save()

    return {
        "simulation": sim.id,
        "simulation_input": simulation_input or None,
        "ef_car_g_per_vkm": float(ef),
        "routes": rows,
        "totals": {
            "vkt_before_km_day": float(round1(total_before)),
            "vkt_after_km_day": float(round1(total_after)),
            "delta_vkt_km_day": float(round1(delta_total)),
            "co2_tons_per_year": float(round1(co2_total_t)),
        },
    }


def co2_calc_and_persist(*, simulation, simulation_input=None, ef_car_g_per_vkm=127):
    return co2_calc_and_persist_routewise(
        simulation=simulation,
        simulation_input=simulation_input,
        ef_car_g_per_vkm=ef_car_g_per_vkm,
    )
