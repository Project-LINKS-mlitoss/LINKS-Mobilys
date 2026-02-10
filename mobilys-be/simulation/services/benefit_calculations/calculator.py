import json
from dataclasses import dataclass
from decimal import Decimal
from math import trunc
from pathlib import Path
from typing import Any, Dict, Iterable, List, NamedTuple, Optional

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction

from simulation.models import BenefitCalculations, DrmLinks
from simulation.services.base import log_service_call
from simulation.services.simulation_service import SimulationService
from simulation.utils.number import round0
from simulation.constants.benefit_calculations import BenefitCalculationConstants

# Exceptions and Data Classes
class OpUnitTableError(Exception):
    """Raised for issues with the op-unit lookup table."""

@dataclass(frozen=True)
class OpUnitRow:
    index: int
    coef_a: float
    intercept_b: float

@dataclass(frozen=True)
class OpUnitTable:
    rows: Dict[int, OpUnitRow]

    @staticmethod
    def from_json_dict(d: Dict) -> "OpUnitTable":
        raw_rows = d.get("rows")
        if not isinstance(raw_rows, list) or not raw_rows:
            raise OpUnitTableError("JSON must contain non-empty 'rows'.")
        out: Dict[int, OpUnitRow] = {}
        for r in raw_rows:
            if isinstance(r, dict):
                idx = int(r.get("index"))
                a = float(r.get("coef_a"))
                b = float(r.get("intercept_b"))
            elif isinstance(r, (list, tuple)) and len(r) >= 3:
                idx = int(r[0])
                a = float(r[1])
                b = float(r[2])
            else:
                raise OpUnitTableError(f"Invalid row format: {r}")
            out[idx] = OpUnitRow(index=idx, coef_a=a, intercept_b=b)
        return OpUnitTable(rows=out)

    def vlookup_exact(self, index: int) -> OpUnitRow:
        try:
            return self.rows[int(index)]
        except KeyError as e:
            raise OpUnitTableError(f"Index {index} not found in op-unit table") from e
        
class TimeCostResult(NamedTuple):
    AJ_before_yen_per_day: float
    AL_after_yen_per_day: float

class OpCostResult(NamedTuple):
    AP_before_yen_per_day: float
    AR_after_yen_per_day: float
    AJ4_unit_yen_per_vkm: float
    AK4_unit_yen_per_vkm: float
    AD_index: int
    AE_index: int

class AccidentCostResult(NamedTuple):
    AU_before_yen_per_year: float
    AW_after_yen_per_year: float

# Helper Functions
def load_op_unit_table() -> OpUnitTable:
    data_path = Path(__file__).resolve().parent.parent / "data" / "op_unit_table.json"
    if not data_path.exists():
        raise OpUnitTableError(f"op_unit_table.json not found at {data_path}")
    data = json.loads(data_path.read_text(encoding="utf-8"))
    return OpUnitTable.from_json_dict(data)

def _index_from_flow(value: float) -> int:
    v = float(value)
    for i, t in enumerate(BenefitCalculationConstants.THRESHOLDS, start=1):
        if v <= t:
            return i
    return 11

def compute_op_cost_unit_before_from_flow(
    *,
    flow_adjustment_before: float,
    table: Optional[OpUnitTable] = None,
) -> float:
    t = table or load_op_unit_table()
    ad = _index_from_flow(flow_adjustment_before)
    row = t.vlookup_exact(ad)
    return row.coef_a * float(flow_adjustment_before) + row.intercept_b

def compute_op_cost_unit_after_from_flow(
    *,
    flow_adjustment_after: float,
    table: Optional[OpUnitTable] = None,
) -> float:
    t = table or load_op_unit_table()
    ae = _index_from_flow(flow_adjustment_after)
    row = t.vlookup_exact(ae)
    return row.coef_a * float(flow_adjustment_after) + row.intercept_b

def _af_from_lanes(lanes: int) -> float:
    return BenefitCalculationConstants._AF_WHEN_LANES_LT_4 if int(lanes) < 4 else BenefitCalculationConstants._AF_WHEN_LANES_GE_4

def _ag_from_lanes(lanes: int) -> float:
    return BenefitCalculationConstants._AG_WHEN_LANES_LT_4 if int(lanes) < 4 else BenefitCalculationConstants._AG_WHEN_LANES_GE_4

def _to_km(length_m: float) -> float:
    return float(length_m) / 1000.0

def _excel_rounddown_nonneg(x: float) -> float:
    return float(trunc(x))

def compute_AM(
    *,
    lanes: int,
    traffic24_total: float,
    length_m: float,
    signal_density_per_km: float,
) -> float:
    af = _af_from_lanes(lanes)
    ag = _ag_from_lanes(lanes)
    c_km = _to_km(length_m)
    ah = _excel_rounddown_nonneg(signal_density_per_km * c_km)
    return af * float(traffic24_total) * c_km + ag * ah

def compute_AN(
    *,
    lanes: int,
    traffic24_total: float,
    length_m: float,
    signal_density_per_km: float,
    d27_param: float,
) -> float:
    af = _af_from_lanes(lanes)
    ag = _ag_from_lanes(lanes)
    c_km = _to_km(length_m)
    o_val = float(traffic24_total) - float(d27_param)
    ah = _excel_rounddown_nonneg(signal_density_per_km * c_km)
    return af * c_km * o_val + ag * ah

def compute_time_costs(
    *,
    total_time_vehicle_hours_before_per_day: float,
    total_time_vehicle_hours_after_per_day: float,
    time_value_unit_yen_per_minute_per_vehicle: float,
) -> TimeCostResult:
    ah = float(time_value_unit_yen_per_minute_per_vehicle)
    aj = float(total_time_vehicle_hours_before_per_day) * ah * 60.0
    al = float(total_time_vehicle_hours_after_per_day) * ah * 60.0
    return TimeCostResult(AJ_before_yen_per_day=aj, AL_after_yen_per_day=al)

def compute_operating_costs(
    *,
    vehicle_km_before_per_day: float,
    vehicle_km_after_per_day: float,
    flow_adjustment_before: float,
    flow_adjustment_after: float,
    table: Optional[OpUnitTable] = None,
) -> OpCostResult:
    t = table or load_op_unit_table()
    ad = _index_from_flow(flow_adjustment_before)
    ae = _index_from_flow(flow_adjustment_after)
    row_b = t.vlookup_exact(ad)
    row_a = t.vlookup_exact(ae)
    aj4 = row_b.coef_a * float(flow_adjustment_before) + row_b.intercept_b
    ak4 = row_a.coef_a * float(flow_adjustment_after) + row_a.intercept_b
    ap = float(vehicle_km_before_per_day) * aj4
    ar = float(vehicle_km_after_per_day) * ak4
    return OpCostResult(
        AP_before_yen_per_day=ap,
        AR_after_yen_per_day=ar,
        AJ4_unit_yen_per_vkm=aj4,
        AK4_unit_yen_per_vkm=ak4,
        AD_index=ad,
        AE_index=ae,
    )





def compute_accident_costs(
    *,
    lanes: int,
    traffic24_total: float,
    length_m: float,
    signal_density_per_km: float,
    d27_param: float,
) -> AccidentCostResult:
    au = compute_AM(
        lanes=lanes,
        traffic24_total=traffic24_total,
        length_m=length_m,
        signal_density_per_km=signal_density_per_km,
    )
    aw = compute_AN(
        lanes=lanes,
        traffic24_total=traffic24_total,
        length_m=length_m,
        signal_density_per_km=signal_density_per_km,
        d27_param=d27_param,
    )
    return AccidentCostResult(AU_before_yen_per_year=au, AW_after_yen_per_year=aw)


def compute_benefit_rows(
    *,
    rows: Iterable[Dict],
    time_value_unit_yen_per_minute_per_vehicle: float,
    d27_param: float,
    table: Optional[OpUnitTable] = None,
) -> Dict[str, List[Dict]]:
    out: List[Dict] = []
    ah = float(time_value_unit_yen_per_minute_per_vehicle)
    t = table or load_op_unit_table()

    for r in rows:
        ac_val = float(r["total_time_vehicle_hours_before_per_day"])
        ae_val = float(r["total_time_vehicle_hours_after_per_day"])
        n_val = float(r["vehicle_km_before_per_day"])
        p_val = float(r["vehicle_km_after_per_day"])
        y_val = float(r["flow_adjustment_before"])
        aa_val = float(r["flow_adjustment_after"])
        j_val = int(r["lanes"])
        m_val = float(r["traffic24_total"])
        c_val = float(r["length_m"])
        k_val = float(r["signal_density_per_km"])

        aj_time = ac_val * ah * 60.0
        al_time = ae_val * ah * 60.0

        ad = _index_from_flow(y_val)
        ae_idx = _index_from_flow(aa_val)
        row_b = t.vlookup_exact(ad)
        row_a = t.vlookup_exact(ae_idx)
        aj4 = row_b.coef_a * y_val + row_b.intercept_b
        ak4 = row_a.coef_a * aa_val + row_a.intercept_b
        ap_op = n_val * aj4
        ar_op = p_val * ak4

        au_acc = compute_AM(
            lanes=j_val,
            traffic24_total=m_val,
            length_m=c_val,
            signal_density_per_km=k_val,
        )
        aw_acc = compute_AN(
            lanes=j_val,
            traffic24_total=m_val,
            length_m=c_val,
            signal_density_per_km=k_val,
            d27_param=d27_param,
        )

        out.append({
            **r,
            "AJ_before_yen_per_day": aj_time,
            "AL_after_yen_per_day": al_time,
            "AP_before_yen_per_day": ap_op,
            "AR_after_yen_per_day": ar_op,
            "AU_before_yen_per_year": au_acc,
            "AW_after_yen_per_year": aw_acc,
            "AJ4_unit_yen_per_vkm": aj4,
            "AK4_unit_yen_per_vkm": ak4,
            "AD_index": ad,
            "AE_index": ae_idx,
        })

    return {"rows": out}

@log_service_call
def compute_benefits_from_payload(
    *,
    payload: Dict[str, Any],
    time_value_unit_yen_per_minute_per_vehicle: float,
    simulation_input,
) -> Dict[str, Any]:
    d27_param = float(payload.get("car_change_number", 0.0))
    ah49 = float(time_value_unit_yen_per_minute_per_vehicle)
    table = load_op_unit_table()

    simulation = None
    sim_id = payload.get("simulation")
    if sim_id is not None:
        try:
            simulation = SimulationService.find_simulation(int(sim_id))
        except (TypeError, ValueError):
            simulation = None

    sum_time_before = 0.0
    sum_time_after = 0.0
    sum_op_before = 0.0
    sum_op_after = 0.0
    sum_acc_before = 0.0
    sum_acc_after = 0.0
    days_per_year = 365.0
    thousand = 1_000.0

    with transaction.atomic():
        service_id = payload.get("service_id")
        for route in payload.get("routes", []):
            route_id = route.get("route_id")
            for shape in route.get("shapes", []):
                shape_id = shape.get("shape_id")
                direction_id = shape.get("direction_id")
                for seg in shape.get("segments", []):
                    code = seg.get("matchcode_shp")
                    if not code:
                        continue

                    metrics = seg.get("metrics", {})

                    try:
                        ac_val = float(metrics["total_time_vehicle_h"]["before"])
                        ae_val = float(metrics["total_time_vehicle_h"]["after"])
                        n_val = float(metrics["vehicle_km_per_day"]["before"])
                        p_val = float(metrics["vehicle_km_per_day"]["after"])
                    except (KeyError, TypeError, ValueError):
                        continue

                    aj_raw = ac_val * ah49 * 60.0
                    al_raw = ae_val * ah49 * 60.0
                    aj = round0(aj_raw / thousand)
                    al = round0(al_raw / thousand)

                    try:
                        y_val = float(metrics["speed_kmh"]["before"])
                    except Exception:
                        y_val = (n_val / ac_val) if ac_val else 0.0

                    ad_idx = _index_from_flow(y_val)
                    row_b = table.vlookup_exact(ad_idx)
                    aj4 = row_b.coef_a * y_val + row_b.intercept_b
                    ap_raw = n_val * aj4
                    ap = round0(ap_raw / thousand)

                    try:
                        speed_after = (
                            p_val / ae_val if ae_val else float(metrics["speed_kmh"]["after"])
                        )
                    except Exception:
                        speed_after = float(metrics["speed_kmh"]["after"])

                    ae_idx = _index_from_flow(speed_after)
                    row_a = table.vlookup_exact(ae_idx)
                    ak4 = row_a.coef_a * speed_after + row_a.intercept_b
                    ar_raw = p_val * ak4
                    ar = round0(ar_raw / thousand)

                    lanes = seg.get("lanes")
                    traffic24_total = seg.get("traffic24_total")
                    length_m = seg.get("length_m")
                    signal_density_per_km = seg.get("signal_density_per_km")

                    if None in (lanes, traffic24_total, length_m, signal_density_per_km):
                        try:
                            link = DrmLinks.objects.only(
                                "lanes", "traffic24_total", "length_m", "signal_density_per_km"
                            ).get(matchcode_shp=code)
                        except ObjectDoesNotExist:
                            continue
                        if lanes is None:
                            lanes = link.lanes
                        if traffic24_total is None:
                            traffic24_total = link.traffic24_total
                        if float(traffic24_total or 0.0) == 0:
                            traffic24_total = float(getattr(link, "vol_up_24h", 0)) + float(
                                getattr(link, "vol_dn_24h", 0)
                            )
                        if length_m is None:
                            length_m = link.length_m
                        if signal_density_per_km is None:
                            signal_density_per_km = link.signal_density_per_km

                    lanes = int(lanes or 0)
                    f_val = float(traffic24_total or 0.0)
                    c_km = float(length_m or 0.0) / 1000.0
                    k_val = float(signal_density_per_km or 0.0)
                    ah_cnt = float(int(k_val * c_km))
                    af = 1850.0 if lanes < 4 else 1110.0
                    ag = 280.0 if lanes < 4 else 370.0

                    au_raw = af * f_val * c_km + ag * ah_cnt
                    o_val = f_val - d27_param
                    aw_raw = af * c_km * o_val + ag * ah_cnt

                    au = round0(au_raw / thousand)
                    aw = round0(aw_raw / thousand)

                    seg["metrics"] = {
                        "travel_time_savings_benefit_yen_per_day": {"before": aj, "after": al},
                        "operating_cost_reduction_benefit_yen_per_day": {"before": ap, "after": ar},
                        "traffic_accident_reduction_benefit_yen_per_year": {"before": au, "after": aw},
                    }

                    sum_time_before += aj
                    sum_time_after += al
                    sum_op_before += ap
                    sum_op_after += ar
                    sum_acc_before += au
                    sum_acc_after += aw

                    if simulation is not None:
                        BenefitCalculations.objects.update_or_create(
                            simulation=simulation,
                            simulation_input_id=simulation_input.id,
                            route_id=route_id or "",
                            shape_id=shape_id or "",
                            service_id=service_id or "",
                            direction_id=direction_id or 0,
                            matchcode_shp=code,
                            defaults={
                                "section_code_csv": seg.get("section_code_csv"),
                                "road_name": seg.get("road_name"),
                                "travel_time_savings_before": Decimal(aj),
                                "travel_time_savings_after": Decimal(al),
                                "operating_cost_reduction_before": Decimal(ap),
                                "operating_cost_reduction_after": Decimal(ar),
                                "traffic_accident_reduction_before": Decimal(au),
                                "traffic_accident_reduction_after": Decimal(aw),
                            },
                        )

    totals = {
        "total_travel_time_savings_benefit_before_per_day":sum_time_before,
        "total_travel_time_savings_benefit_after_per_day": sum_time_after,
        "total_operating_cost_reduction_benefit_before_per_day": sum_op_before,
        "total_operating_cost_reduction_benefit_after_per_day": sum_op_after,
        "total_traffic_accident_reduction_benefit_before_per_year": sum_acc_before,
        "total_traffic_accident_reduction_benefit_after_per_year": sum_acc_after,
    }

    payload["totals"] = totals
    payload["annual_benefits"] = {
        "annual_travel_time_savings_benefit": (
            totals["total_travel_time_savings_benefit_before_per_day"]
            - totals["total_travel_time_savings_benefit_after_per_day"]
        )* days_per_year,
        "annual_operating_cost_reduction_benefit": (
            totals["total_operating_cost_reduction_benefit_before_per_day"]
            - totals["total_operating_cost_reduction_benefit_after_per_day"]
        )* days_per_year,
        "annual_traffic_accident_reduction_benefit": (
            totals["total_traffic_accident_reduction_benefit_before_per_year"]
            - totals["total_traffic_accident_reduction_benefit_after_per_year"]
        ),
    }
    payload["annual_total_benefit"] = round(
        payload["annual_benefits"]["annual_travel_time_savings_benefit"]
        + payload["annual_benefits"]["annual_operating_cost_reduction_benefit"]
        + payload["annual_benefits"]["annual_traffic_accident_reduction_benefit"],
        0,
    )

    return payload
