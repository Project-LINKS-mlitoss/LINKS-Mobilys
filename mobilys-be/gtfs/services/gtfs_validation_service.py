from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import requests
from django.db import DatabaseError

from gtfs.models import GtfsValidationResult
from gtfs.services.base import log_service_call
from gtfs.services.gtfs_validator import GtfsValidatorService
from gtfs.utils.gtfs_safe_notices_utils import get_safe_notice_registry
from gtfs.utils.gtfs_validator_utils import get_notice_metadata
from gtfs.utils.scenario_utils import get_accessible_scenario_or_404
from gtfs.constants import ErrorMessages, ValidationSeverity
from mobilys_BE.shared.log_json import log_json

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ApiError(Exception):
    payload: dict[str, Any]
    status_code: int


@log_service_call
class GtfsValidationApiService:
    @staticmethod
    def run_validation(*, user: Any, scenario_id: Any) -> dict[str, Any]:
        if not scenario_id:
            raise ApiError(payload={"error": ErrorMessages.SCENARIO_ID_REQUIRED_EN}, status_code=400)

        scenario = get_accessible_scenario_or_404(user=user, scenario_id=scenario_id)

        try:
            result = GtfsValidatorService.validate_scenario(scenario)
            summary = GtfsValidatorService.calculate_summary(result.notices)

            log_json(
                logger,
                logging.INFO,
                "gtfs_validation_completed",
                scenario_id=str(scenario_id),
                validation_id=str(result.id),
                blocking_error_count=summary["blocking_error_count"],
            )

            return {
                "message": "Validation completed",
                "validation_id": str(result.id),
                "summary": {
                    "has_blocking_errors": summary["blocking_error_count"] > 0,
                    **summary,
                },
            }

        except requests.RequestException as e:
            log_json(
                logger,
                logging.ERROR,
                "gtfs_validation_api_error",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise ApiError(
                payload={"error": ErrorMessages.VALIDATION_SERVICE_UNAVAILABLE_EN, "detail": str(e)},
                status_code=503,
            ) from e
        except ValueError as e:
            log_json(
                logger,
                logging.ERROR,
                "gtfs_validation_invalid_response",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise ApiError(
                payload={"error": ErrorMessages.INVALID_VALIDATION_SERVICE_RESPONSE_EN, "detail": str(e)},
                status_code=502,
            ) from e

    @staticmethod
    def get_validation_result(
        *,
        user: Any,
        scenario_id: Optional[str],
        severity: Optional[str],
        code: Optional[str],
        is_safe: Optional[str],
        lang: str,
    ) -> dict[str, Any]:
        if not scenario_id:
            raise ApiError(payload={"error": ErrorMessages.SCENARIO_ID_REQUIRED_EN}, status_code=400)

        scenario = get_accessible_scenario_or_404(user=user, scenario_id=scenario_id)

        try:
            result = scenario.validation_result
        except GtfsValidationResult.DoesNotExist as e:
            raise ApiError(
                payload={"error": ErrorMessages.NO_VALIDATION_RESULT_FOUND_EN},
                status_code=404,
            ) from e

        try:
            notices = GtfsValidationApiService._filter_notices(
                notices=result.notices,
                severity=severity,
                code=code,
                is_safe=is_safe,
            )
            notices = GtfsValidationApiService._apply_fixable_flags(notices)

            summary_notices = GtfsValidationApiService._apply_fixable_flags(
                [n for n in result.notices if not n.get("skip", False)]
            )
            summary = GtfsValidatorService.calculate_summary(summary_notices)

            categorized = GtfsValidationApiService._categorize_notices(notices, lang)

            log_json(
                logger,
                logging.INFO,
                "gtfs_validation_result_retrieved",
                scenario_id=str(scenario_id),
                total_notices=len(notices),
            )

            return {
                "scenario_id": str(scenario.id),
                "scenario_name": scenario.scenario_name,
                "validated_at": result.validated_at,
                "validator_version": result.validator_version,
                "summary": {
                    "has_blocking_errors": summary["blocking_error_count"] > 0,
                    **summary,
                },
                **categorized,
            }

        except DatabaseError as e:
            log_json(
                logger,
                logging.ERROR,
                "gtfs_validation_result_db_error",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise ApiError(payload={"error": ErrorMessages.DATABASE_ERROR_OCCURRED_EN}, status_code=500) from e
        except ApiError:
            raise
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "gtfs_validation_result_unexpected_error",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise ApiError(payload={"error": ErrorMessages.UNEXPECTED_ERROR_OCCURRED_EN}, status_code=500) from e

    @staticmethod
    def _filter_notices(
        *,
        notices: list[dict[str, Any]],
        severity: Optional[str],
        code: Optional[str],
        is_safe: Optional[str],
    ) -> list[dict[str, Any]]:
        filtered = [n for n in notices if not n.get("skip", False)]

        if severity:
            severity_upper = severity.upper()
            filtered = [n for n in filtered if n.get("severity") == severity_upper]

        if code:
            filtered = [n for n in filtered if n.get("code") == code]

        if is_safe is not None:
            is_safe_bool = is_safe.lower() == "true"
            filtered = [n for n in filtered if n.get("is_safe", False) == is_safe_bool]

        return filtered

    @staticmethod
    def _categorize_notices(notices: list[dict[str, Any]], lang: str) -> dict[str, Any]:
        categorized: dict[str, list[dict[str, Any]]] = {
            "blocking_errors": [],
            "safe_notices": [],
            "fixable_notices": [],
            "warnings": [],
            "infos": [],
        }

        for notice in notices:
            code = notice.get("code", "")
            severity = notice.get("severity", "")
            is_safe = notice.get("is_safe", False)
            is_fixable = notice.get("is_fixable", False)

            metadata = get_notice_metadata(code, lang)
            enriched = {**notice, "title": metadata["title"]}

            if severity == ValidationSeverity.ERROR.value and is_fixable:
                categorized["fixable_notices"].append(enriched)
            elif is_safe:
                categorized["safe_notices"].append(enriched)
            elif severity == ValidationSeverity.ERROR.value:
                categorized["blocking_errors"].append(enriched)
            elif severity == ValidationSeverity.WARNING.value:
                categorized["warnings"].append(enriched)
            elif severity == ValidationSeverity.INFO.value:
                categorized["infos"].append(enriched)

        return categorized

    @staticmethod
    def _apply_fixable_flags(notices: list[dict[str, Any]]) -> list[dict[str, Any]]:
        registry = get_safe_notice_registry()
        enriched: list[dict[str, Any]] = []

        for notice in notices:
            severity = notice.get("severity", "")
            is_fixable = False
            fixable_rule = None
            if severity == ValidationSeverity.ERROR.value:
                is_fixable, fixable_rule = registry.is_fixable_notice(notice)

            reason_ja = notice.get("reason_ja", None)
            reason_en = notice.get("reason_en", None)

            if reason_ja is None:
                reason_ja = notice.get("safe_reason_ja", None)
            if reason_en is None:
                reason_en = notice.get("safe_reason_en", None)

            if is_fixable and fixable_rule is not None:
                reason_ja = fixable_rule.reason_ja
                reason_en = fixable_rule.reason_en

            enriched.append(
                {
                    **notice,
                    "is_fixable": is_fixable,
                    "reason_ja": reason_ja,
                    "reason_en": reason_en,
                }
            )

        return enriched
