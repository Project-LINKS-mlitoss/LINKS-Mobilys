import logging
import re
from typing import Any, Optional, Tuple

from gtfs.models import Calendar, CalendarDates, Scenario
from simulation.models import SimulationInput
from simulation.services.base import NotFoundError, ValidationError, log_service_call
from simulation.services.simulation_init_service import (
    CSVTemplateError,
    SimulationInitService,
    _get_field,
    _parse_date_flexible,
    _req_float_form,
    _validate_ic_csv_file,
    analyze_ic_csv_against_simulation,
)
from simulation.services.simulation_service import SimulationService
from simulation.services.validation_service import ValidationService

logger = logging.getLogger(__name__)


def _as_service_id_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        items = [str(x).strip() for x in value]
    else:
        s = str(value).strip()
        items = re.split(r",", s) if s else []
    out: list[str] = []
    seen: set[str] = set()
    for x in items:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _parse_bool_optional(value, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value

    s = str(value).strip().lower()
    if s in {"1", "true", "t", "yes", "y", "on"}:
        return True
    if s in {"0", "false", "f", "no", "n", "off"}:
        return False
    raise ValueError("invalid_bool")


def _parse_non_negative_int_optional(value, *, default: int) -> int:
    if value is None or value == "":
        return default
    parsed = int(str(value).strip())
    if parsed < 0:
        raise ValueError("negative_int")
    return parsed


class SimulationInitApiService:
    @staticmethod
    @log_service_call
    def get_latest_init_payload(*, simulation_id: str) -> dict:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario", "duplicated_scenario"),
            not_found_message="simulation_not_found",
            not_found_code="simulation_not_found",
        )

        sim_input = (
            SimulationInput.objects.filter(simulation=sim).order_by("-created_at").first()
        )
        if not sim_input:
            raise NotFoundError(
                message="not_found",
                code="not_found",
            )

        service_ids_arr: list[str] = []
        if sim_input.service_id:
            service_ids_arr = [s for s in sim_input.service_id.split(",") if s]

        return {
            "id": sim_input.id,
            "original_scenario": {
                "id": str(sim.original_scenario.id) if sim.original_scenario else None,
                "name": sim.original_scenario.scenario_name if sim.original_scenario else None,
            },
            "duplicated_scenario": {
                "id": str(sim.duplicated_scenario.id) if sim.duplicated_scenario else None,
                "name": sim.duplicated_scenario.scenario_name if sim.duplicated_scenario else None,
            },
            "simulation_id": str(sim.id),
            "params": {
                "service_date": sim_input.service_date.isoformat(),
                "service_id": sim_input.service_id,
                "service_ids": service_ids_arr,
                "epsilon_inc": sim_input.sensitivity_up,
                "epsilon_dec": sim_input.sensitivity_down,
                "cost_per_share": sim_input.trip_cost,
                "car_share": sim_input.car_share,
                "time_value_yen_per_min_per_vehicle": sim_input.time_value_yen_per_min_per_vehicle,
                "default_fare": sim_input.default_fare,
            },
            "source_file": {
                "name": sim_input.source_file_name or "",
                "size": sim_input.source_file_size or 0,
                "type": sim_input.source_file_type or "",
            },
            "status": sim_input.status,
            "created_at": sim_input.created_at.isoformat(),
            "updated_at": sim_input.updated_at.isoformat(),
        }

    @staticmethod
    @log_service_call
    def create_init_payload(*, data: Any, file_obj) -> Tuple[dict, str]:
        try:
            simulation_id = _get_field(data, "simulation_id", required=True)
        except ValueError as exc:
            raise ValidationError(message="missing_simulation_id", code="missing_simulation_id") from exc

        sd_raw = _get_field(data, ["service_date", "serviceDate"], required=True)
        service_date = _parse_date_flexible(sd_raw)
        if not service_date:
            raise ValidationError(message="invalid_service_date", code="invalid_service_date")

        raw_sids = (
            data.get("service_ids")
            or data.get("serviceIds")
            or _get_field(data, ["service_id", "serviceId"], required=True)
        )
        service_ids = _as_service_id_list(raw_sids)
        if not service_ids:
            raise ValidationError(message="missing_service_id", code="missing_service_id")

        try:
            sensitivity_up = _req_float_form(
                data,
                ["epsilon_inc", "sensitivity_up"],
                "epsilon_inc/sensitivity_up",
            )
            sensitivity_down = _req_float_form(
                data,
                ["epsilon_dec", "sensitivity_down"],
                "epsilon_dec/sensitivity_down",
            )
            trip_cost = _req_float_form(
                data,
                ["costPerVehKmYen", "cost_per_share"],
                "costPerVehKmYen/cost_per_share",
            )
            car_share = _req_float_form(
                data,
                ["carShare", "car_share"],
                "carShare/car_share",
            )
            time_value = _req_float_form(
                data,
                ["timeValueYenPerMin_perVehicle", "time_value_yen_per_min_per_vehicle"],
                "timeValueYenPerMin_perVehicle/time_value_yen_per_min_per_vehicle",
            )
            default_fare = _req_float_form(
                data,
                ["defaultFare", "default_fare"],
                "defaultFare/default_fare",
            )
            prefer_bus = _parse_bool_optional(
                _get_field(
                    data,
                    ["same_with_bus", "sameWithBus", "prefer_bus", "preferBus"],
                    required=False,
                ),
                default=False,
            )
            bus_buffer_m = _parse_non_negative_int_optional(
                _get_field(
                    data,
                    ["buffer_bus", "bufferBus", "bus_buffer_m", "busBufferM"],
                    required=False,
                ),
                default=10,
            )
            csv_penalty_raw = _get_field(
                data,
                ["csv_penalty_factor", "csvPenaltyFactor"],
                required=False,
            )
            csv_penalty_factor = float(csv_penalty_raw) if csv_penalty_raw is not None else 10.0
        except ValueError as exc:
            msg = str(exc)
            if msg.startswith("missing:"):
                field_names = msg.split(":", 1)[1]
                raise ValidationError(
                    message="missing_numeric_field",
                    code="missing_numeric_field",
                    details={"field_names": field_names},
                ) from exc
            if msg.startswith("invalid_float:"):
                label = msg.split(":", 1)[1]
                raise ValidationError(
                    message=label,
                    code="invalid_numeric",
                ) from exc
            if msg in {"invalid_bool", "negative_int"}:
                raise ValidationError(
                    message="invalid_candidate_parameter",
                    code="invalid_numeric",
                ) from exc
            raise ValidationError(message="invalid_numeric", code="invalid_numeric") from exc

        source_file_name = getattr(file_obj, "name", "") or ""
        source_file_size = getattr(file_obj, "size", 0) or 0
        source_file_type = getattr(file_obj, "content_type", "") or ""

        if file_obj:
            try:
                _validate_ic_csv_file(file_obj)
            except CSVTemplateError as exc:
                raise ValidationError(message=str(exc), code="invalid_csv") from exc
            except Exception as exc:
                logger.exception("ic_csv_validation_failed", extra={"simulation_id": str(simulation_id)})
                raise ValidationError(message="csv_parse_error", code="csv_parse_error") from exc

        sim, sim_input = SimulationInitService.initialize(
            simulation_id=str(simulation_id),
            service_date=service_date,
            service_ids=service_ids,
            sensitivity_up=sensitivity_up,
            sensitivity_down=sensitivity_down,
            trip_cost=trip_cost,
            car_share=car_share,
            time_value=time_value,
            default_fare=default_fare,
            prefer_bus=prefer_bus,
            bus_buffer_m=bus_buffer_m,
            csv_penalty_factor=csv_penalty_factor,
            file_obj=file_obj,
            source_file_name=source_file_name,
            source_file_size=source_file_size,
            source_file_type=source_file_type,
        )

        resp = {
            "id": sim_input.id,
            "simulationId": str(sim.id),
            "original_scenario": {
                "id": str(sim.original_scenario.id) if sim.original_scenario else None,
                "name": getattr(sim.original_scenario, "scenario_name", None) if sim.original_scenario else None,
            },
            "duplicated_scenario": {
                "id": str(sim.duplicated_scenario.id) if sim.duplicated_scenario else None,
                "name": getattr(sim.duplicated_scenario, "scenario_name", None) if sim.duplicated_scenario else None,
            },
            "params": {
                "serviceDate": sim_input.service_date.isoformat(),
                "serviceId": sim_input.service_id,
                "serviceIds": service_ids,
                "epsilon_inc": sim_input.sensitivity_up,
                "epsilon_dec": sim_input.sensitivity_down,
                "costPerVehKmYen": sim_input.trip_cost,
                "carShare": sim_input.car_share,
                "timeValueYenPerMin_perVehicle": sim_input.time_value_yen_per_min_per_vehicle,
                "defaultFare": sim_input.default_fare,
                "same_with_bus": prefer_bus,
                "buffer_bus": bus_buffer_m,
            },
            "source_file": {
                "name": sim_input.source_file_name or "",
                "size": sim_input.source_file_size or 0,
                "type": sim_input.source_file_type or "",
            },
            "status": sim_input.status,
            "createdAt": sim_input.created_at.isoformat(),
            "updatedAt": sim_input.updated_at.isoformat(),
        }
        return resp, str(simulation_id)

    @staticmethod
    @log_service_call
    def diff_csv_against_simulation(*, simulation_id: str, file_obj) -> Tuple[dict, str]:
        sim = SimulationService.get_simulation(
            simulation_id,
            select_related=("original_scenario", "duplicated_scenario"),
            not_found_message="simulation_not_found",
            not_found_code="simulation_not_found",
        )
        if not sim.original_scenario or not sim.duplicated_scenario:
            raise ValidationError(message="missing_scenarios", code="missing_scenarios")

        if not file_obj:
            raise ValidationError(message="missing_file", code="missing_file")

        try:
            _validate_ic_csv_file(file_obj)
        except CSVTemplateError as exc:
            raise ValidationError(message=str(exc), code="invalid_csv") from exc
        except Exception as exc:
            logger.exception("ic_csv_validation_failed_on_diff_api", extra={"simulation_id": str(simulation_id)})
            raise ValidationError(message="csv_parse_error", code="csv_parse_error") from exc

        analysis = analyze_ic_csv_against_simulation(file_obj, simulation=sim)

        if analysis.get("invalid_trip_count"):
            message = "Some CSV rows do not match either scenario."
        elif not analysis.get("trip_count_comparisons"):
            message = "No service patterns were found for comparison."
        elif analysis.get("all_trip_counts_equal"):
            message = "Trip counts are the same between original and duplicated scenarios."
        else:
            message = "Trip counts differ between original and duplicated scenarios."

        return analysis, message

    @staticmethod
    @log_service_call
    def union_service_ids(*, simulation_id: str, date_str: str) -> list[str]:
        sim = SimulationService.get_simulation(
            simulation_id,
            not_found_message="simulation_not_found",
            not_found_code="simulation_not_found",
        )

        d = _parse_date_flexible((date_str or "").strip())
        if not d:
            raise ValidationError(message="invalid_date", code="invalid_date")

        scenario_ids = [sid for sid in [sim.original_scenario_id, sim.duplicated_scenario_id] if sid]
        if not scenario_ids:
            raise ValidationError(message="no_scenarios", code="no_scenarios")

        found = set(Scenario.objects.filter(id__in=scenario_ids).values_list("id", flat=True))
        missing = [str(sid) for sid in scenario_ids if sid not in found]
        if missing:
            raise NotFoundError(message="scenario_not_found", code="scenario_not_found")

        weekday_fields = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        weekday_field = weekday_fields[d.weekday()]

        rows = (
            Calendar.objects.filter(
                scenario__in=scenario_ids,
                start_date__lte=d,
                end_date__gte=d,
                **{weekday_field: 1},
            ).values("scenario_id", "service_id")
        )

        services_by_scn: dict[str, set[str]] = {str(sid): set() for sid in scenario_ids}
        for r in rows:
            sid = str(r["scenario_id"])
            services_by_scn.setdefault(sid, set()).add(r["service_id"])

        cd_rows = (
            CalendarDates.objects.filter(
                scenario_id__in=scenario_ids,
                date=d,
            ).values("scenario_id", "service_id", "exception_type")
        )

        for cd in cd_rows:
            sid = str(cd["scenario_id"])
            service_id = cd["service_id"]
            exception_type = cd["exception_type"]

            current = services_by_scn.setdefault(sid, set())
            if exception_type == 1:
                current.add(service_id)
            elif exception_type == 2:
                current.discard(service_id)

        union_services: set[str] = set()
        for sset in services_by_scn.values():
            union_services |= sset

        return sorted(union_services)

    @staticmethod
    @log_service_call
    def validate_and_save_csv_payload(
        *,
        simulation_id: str,
        simulation_input_id: Optional[str],
        file_obj,
    ) -> dict:
        return ValidationService.validate_and_save_csv_by_ids(
            simulation_id=str(simulation_id),
            simulation_input_id=simulation_input_id,
            file_obj=file_obj,
        )
