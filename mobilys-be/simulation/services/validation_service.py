# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Any, Dict, Optional

from simulation.models import Simulation, SimulationInput, SimulationValidationResult
from simulation.services.base import ValidationError, log_service_call, transactional
from simulation.services.simulation_init_service import run_csv_validation
from simulation.services.simulation_init_service import enrich_validation_result_with_patterns
from simulation.services.simulation_service import SimulationService


def build_summary_counts(result_json: Dict[str, Any]) -> Dict[str, int]:
    cmp = result_json.get("trip_count_comparisons") or []
    with_diff = sum(1 for r in cmp if int(r.get("difference") or 0) != 0)
    no_diff = sum(1 for r in cmp if int(r.get("difference") or 0) == 0)
    invalid_rows = len(result_json.get("invalid_rows") or [])
    return {"with_diff": with_diff, "no_diff": no_diff, "invalid_rows": invalid_rows}


class ValidationService:
    @staticmethod
    @log_service_call
    def validate_and_save_csv_by_ids(
        *,
        simulation_id: str,
        file_obj,
        simulation_input_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        simulation = SimulationService.get_simulation(
            simulation_id,
            not_found_message="simulation_not_found",
            not_found_code="simulation_not_found",
        )

        simulation_input: Optional[SimulationInput] = None
        if simulation_input_id:
            try:
                simulation_input = SimulationInput.objects.get(
                    pk=simulation_input_id, simulation=simulation
                )
            except SimulationInput.DoesNotExist as exc:
                raise ValidationError(
                    message="invalid_simulation_input_id",
                    code="invalid_simulation_input_id",
                ) from exc

        return ValidationService.validate_and_save_csv(
            simulation=simulation,
            file_obj=file_obj,
            simulation_input=simulation_input,
        )

    @staticmethod
    @log_service_call
    @transactional
    def validate_and_save_csv(
        *,
        simulation: Simulation,
        file_obj,
        simulation_input: Optional[SimulationInput],
    ) -> Dict[str, Any]:
        try:
            result_json = run_csv_validation(file_obj, simulation=simulation, simulation_input=simulation_input)
        except Exception as e:
            raise ValidationError(
                message="csv_processing_error",
                code="csv_processing_error",
                details={"exception": str(e)},
            )

        try:
            prev = SimulationValidationResult.objects.filter(simulation=simulation, is_latest=True) \
                                                    .order_by("-version").first()
        except Exception as e:
            raise ValidationError(
                message="fetch_previous_error",
                code="fetch_previous_error",
                details={"exception": str(e)},
            )

        next_ver = (prev.version + 1) if prev else 1
        if prev:
            prev.is_latest = False
            prev.save(update_fields=["is_latest", "updated_at"])

        try:
            svr = SimulationValidationResult.objects.create(
                simulation=simulation,
                simulation_input=simulation_input,
                service_date=result_json.get("service_date") or "",
                service_id=(result_json.get("service_ids") or [None])[0] or "",
                service_ids=result_json.get("service_ids") or [],
                result_json=result_json,
                summary_counts=build_summary_counts(result_json),
                status="ok",
                version=next_ver,
                is_latest=True,
            )
            svr.set_file_meta(file_obj)
            svr.save(update_fields=["file_name", "file_size", "file_sha256", "updated_at"])
        except Exception as e:
            raise ValidationError(
                message="save_error",
                code="save_error",
                details={"exception": str(e)},
            )

        payload = result_json.copy()
        payload["persisted"] = True
        payload["saved_at"] = svr.updated_at.isoformat()
        payload["version"] = svr.version
        return payload

    @staticmethod
    @log_service_call
    @transactional
    def get_latest_validation_result(*, simulation_id: str) -> Optional[SimulationValidationResult]:
        svr = (
            SimulationValidationResult.objects.filter(
                simulation_id=simulation_id, is_latest=True
            )
            .order_by("-updated_at")
            .first()
        )
        if not svr:
            return None

        result_json = svr.result_json or {}
        comparisons = result_json.get("trip_count_comparisons", [])
        needs_enrichment = comparisons and "pattern_id" not in comparisons[0]

        if not needs_enrichment:
            return svr

        sim = SimulationService.find_simulation(str(simulation_id))
        if not sim:
            return svr

        enriched_result = enrich_validation_result_with_patterns(result_json, sim)
        svr.result_json = enriched_result
        svr.save(update_fields=["result_json", "updated_at"])
        return svr

    @staticmethod
    @log_service_call
    @transactional
    def delete_validation_results(*, simulation_id: str) -> int:
        deleted_count, _ = SimulationValidationResult.objects.filter(
            simulation_id=simulation_id
        ).delete()
        return int(deleted_count or 0)
