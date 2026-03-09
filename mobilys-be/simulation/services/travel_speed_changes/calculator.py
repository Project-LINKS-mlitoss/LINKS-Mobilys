# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Any, Dict, Optional, Union

from django.core.exceptions import ObjectDoesNotExist

from simulation.models import DrmLinks
from simulation.services.travel_speed_changes.speed_table import (
    bucket_row_index_from_signal_density,
    cap_signal_density,
    compute_flow_adjustment,
    compute_r_from_congestion,
    compute_u_from_p_and_r,
    get_speed_table,
)
from simulation.utils.number import round0, round1, round4, safe_div


class MissingFieldError(Exception):
    """Raised when required fields on DrmLinks are missing."""


def require_fields(
    link: DrmLinks,
    *,
    need_congestion: bool = False,
    need_signal_density: bool = False,
    need_traffic24: bool = False,
) -> None:
    """Validate that required DrmLinks fields are not NULL."""
    missing = []
    if need_congestion and link.congestion_index is None:
        missing.append("congestion_index")
    if need_signal_density and link.signal_density_per_km is None:
        missing.append("signal_density_per_km")
    if need_traffic24 and link.traffic24_total is None:
        missing.append("traffic24_total")
    if missing:
        raise MissingFieldError(f"DrmLinks(id={link.id}) missing: {', '.join(missing)}")


def _coerce_link(link_or_id: Union[int, DrmLinks]) -> DrmLinks:
    """Accept a DrmLinks instance or an id; returns an instance or raises."""
    if isinstance(link_or_id, DrmLinks):
        return link_or_id
    try:
        return DrmLinks.objects.get(pk=int(link_or_id))
    except (ValueError, TypeError, ObjectDoesNotExist) as e:
        raise ObjectDoesNotExist(f"DrmLinks(id={link_or_id}) not found") from e


def compute_speed_delta_baseline_for_link(link_or_id: Union[int, DrmLinks]) -> float:
    """
    Excel Column Y.

    Mapping:
      G = link.congestion_index
      R = ROUNDDOWN(max(G, 0.5),1)
      S = min(link.signal_density_per_km, 4)
      T = bucket(S) -> {2,4,6,8,10}
      N = G
      Y = HLOOKUP(R, speed table, T) * N + HLOOKUP(R, speed table, T+1)
    """
    link = _coerce_link(link_or_id)
    require_fields(link, need_congestion=True, need_signal_density=True)

    g_val = float(link.congestion_index)
    r_val = compute_r_from_congestion(g_val)
    n_val = g_val

    s_val = cap_signal_density(float(link.signal_density_per_km))
    t_idx = bucket_row_index_from_signal_density(s_val)

    table = get_speed_table()
    return round(table.compute_combo_excel(r_val, t_idx, n_val), 2)


def compute_speed_delta_after_change_for_link(
    link_or_id: Union[int, DrmLinks],
    *,
    changes_in_number_of_cars: float,
) -> float:
    """
    Excel Column AA.

    Mapping:
      G = link.congestion_index
      R = ROUNDDOWN(max(G, 0.5),1)
      F = link.traffic24_total
      O = F - changes_in_number_of_cars
      P = O * G / F
      U = ROUNDDOWN(IF(P<0.5,0.5,IF(R>2,2,P)), 1)
      S = min(link.signal_density_per_km, 4)
      W = bucket(S)
      AA = HLOOKUP(U, speed table, W) * P + HLOOKUP(U, speed table, W+1)
    """
    link = _coerce_link(link_or_id)
    require_fields(link, need_congestion=True, need_signal_density=True, need_traffic24=True)

    g_val = float(link.congestion_index)
    r_val = compute_r_from_congestion(g_val)
    f_val = float(link.traffic24_total)
    if f_val == 0:
        f_val = float(getattr(link, "vol_up_24h", 0)) + float(getattr(link, "vol_dn_12h", 0))
    o_val = f_val - float(changes_in_number_of_cars)
    p_val = compute_flow_adjustment(o_val, g_val, f_val)
    u_val = compute_u_from_p_and_r(p_val, r_val)

    s_val = cap_signal_density(float(link.signal_density_per_km))
    w_idx = bucket_row_index_from_signal_density(s_val)

    table = get_speed_table()
    return round(table.compute_combo_excel(u_val, w_idx, p_val), 2)


def compute_speed_delta_baseline_for_matchcode(
    matchcode_shp: str,
    *,
    startswith: bool = False,
) -> Dict[int, float]:
    """
    Column Y for all links with matchcode_shp == code (or startswith if True).
    Returns {link_id: value}. Links with missing fields are skipped.
    """
    get_speed_table()
    filt = {"matchcode_shp__startswith": matchcode_shp} if startswith else {"matchcode_shp": matchcode_shp}
    qs = DrmLinks.objects.filter(**filt).only("id", "congestion_index", "signal_density_per_km")
    out: Dict[int, float] = {}
    for link in qs:
        try:
            out[link.id] = compute_speed_delta_baseline_for_link(link)
        except MissingFieldError:
            continue
    return out


def compute_speed_delta_after_change_for_matchcode(
    matchcode_shp: str,
    *,
    changes_in_number_of_cars: float,
    startswith: bool = False,
) -> Dict[int, float]:
    """
    Column AA for all links with matchcode_shp == code (or startswith if True).
    Returns {link_id: value}. Links with missing fields are skipped.
    """
    get_speed_table()
    filt = {"matchcode_shp__startswith": matchcode_shp} if startswith else {"matchcode_shp": matchcode_shp}
    qs = DrmLinks.objects.filter(**filt).only("id", "congestion_index", "signal_density_per_km", "traffic24_total")
    out: Dict[int, float] = {}
    for link in qs:
        try:
            out[link.id] = compute_speed_delta_after_change_for_link(
                link, changes_in_number_of_cars=changes_in_number_of_cars
            )
        except MissingFieldError:
            continue
    return out


def compute_speed_time_nested_response(
    data4: Dict[str, Any],
    *,
    use_global_delta_for_speed: bool = True,
) -> Dict[str, Any]:
    """
    Input:
      {
        "car_change_number": 45.36,
        "service_id": "...",
        "routes": [ ... ]
      }
    """
    global_delta = float(data4.get("car_change_number", 0.0))
    get_speed_table()

    out: Dict[str, Any] = {
        "service_id": data4.get("service_id"),
        "routes": [],
    }

    for route in data4.get("routes", []):
        route_out: Dict[str, Any] = {
            "route_id": route.get("route_id"),
            "service_id": route.get("service_id"),
            "shapes": [],
        }

        for shape in route.get("shapes", []):
            shape_out: Dict[str, Any] = {
                "shape_id": shape.get("shape_id"),
                "direction_id": shape.get("direction_id"),
                "segments": [],
            }

            for seg in shape.get("segments", []):
                code: Optional[str] = seg.get("matchcode_shp")
                if not code:
                    continue

                length_m = float(seg.get("length_m", 0.0))
                length_km = length_m / 1000.0

                before_cars = seg.get("before_cars_per_day", seg.get("traffic24_total"))
                if before_cars is None:
                    continue
                before_cars = float(before_cars)

                after_cars = seg.get("after_cars_per_day")
                if after_cars is None:
                    after_cars = before_cars + global_delta
                else:
                    after_cars = float(after_cars)

                vkm_before = seg.get("before_vehicle_km_per_day")
                vkm_after = seg.get("after_vehicle_km_per_day")
                if vkm_before is None:
                    vkm_before = length_km * before_cars
                if vkm_after is None:
                    vkm_after = length_km * after_cars

                y_map = compute_speed_delta_baseline_for_matchcode(code, startswith=False)
                if not y_map:
                    continue
                speed_before = next(iter(y_map.values()))

                delta_for_speed = global_delta
                if not use_global_delta_for_speed:
                    delta_for_speed = float(seg.get("delta_cars_per_day", global_delta))

                aa_map = compute_speed_delta_after_change_for_matchcode(
                    code,
                    changes_in_number_of_cars=delta_for_speed,
                    startswith=False,
                )
                if not aa_map:
                    continue
                speed_after = next(iter(aa_map.values()))

                t_per_before_raw = safe_div(length_km, speed_before)
                t_per_after_raw = safe_div(length_km, speed_after)

                t_per_before_disp = round4(t_per_before_raw)
                t_per_after_disp = round4(t_per_after_raw)

                total_before = t_per_before_disp * before_cars
                total_after = t_per_after_disp * after_cars

                seg_out = {
                    "matchcode_shp": code,
                    "section_code_csv": seg.get("section_code_csv"),
                    "road_name": seg.get("road_name"),
                    "metrics": {
                        "speed_kmh": {
                            "before": round1(speed_before),
                            "after": round1(speed_after),
                        },
                        "time_per_vehicle_h": {
                            "before": t_per_before_disp,
                            "after": t_per_after_disp,
                        },
                        "total_time_vehicle_h": {
                            "before": round0(total_before),
                            "after": round0(total_after),
                        },
                        "vehicle_km_per_day": {
                            "before": round0(vkm_before),
                            "after": round0(vkm_after),
                        },
                    },
                }
                shape_out["segments"].append(seg_out)

            route_out["shapes"].append(shape_out)

        out["routes"].append(route_out)

    return out

