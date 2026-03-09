# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

from gtfs.constants import ErrorMessages
from gtfs.models import RidershipRecord, RidershipUpload, Scenario
from gtfs.utils.one_detailed_boarding_alighting_utils import (
    boarding_alighting_rows_to_csv,
    convert_one_detailed_to_boarding_alighting,
    convert_ridership_records_to_boarding_alighting,
    read_uploaded_file,
)
from gtfs.services.base import log_service_call


class OneDetailedBoardingAlightingServiceError(Exception):
    def __init__(self, *, message: str, status_code: int):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class BoardingAlightingConversionResult:
    boarding_alighting_rows: list[dict[str, Any]]
    errors: list[dict[str, Any]]
    total_input_rows: int
    source_type: str


@log_service_call
class OneDetailedBoardingAlightingService:
    
    @staticmethod
    def convert(
        *,
        user,
        scenario_id,
        uploaded_file_bytes: bytes | None = None,
        uploaded_filename: str | None = None,
        ridership_upload_id=None,
    ) -> BoardingAlightingConversionResult:
        OneDetailedBoardingAlightingService._assert_scenario_access(user=user, scenario_id=scenario_id)

        if uploaded_file_bytes is not None and uploaded_filename:
            return OneDetailedBoardingAlightingService._convert_from_file(
                uploaded_file_bytes=uploaded_file_bytes,
                uploaded_filename=uploaded_filename,
                scenario_id=str(scenario_id),
            )

        return OneDetailedBoardingAlightingService._convert_from_ridership_upload(
            user=user,
            ridership_upload_id=ridership_upload_id,
            scenario_id=str(scenario_id),
        )

    @staticmethod
    def build_metadata_payload(*, result: BoardingAlightingConversionResult) -> dict[str, Any]:
        csv_content = boarding_alighting_rows_to_csv(result.boarding_alighting_rows)
        return {
            "success": True,
            "source_type": result.source_type,
            "total_input_rows": result.total_input_rows,
            "total_output_rows": len(result.boarding_alighting_rows),
            "error_count": len(result.errors),
            "errors": result.errors,
            "csv_content": csv_content,
        }

    @staticmethod
    def _assert_scenario_access(*, user, scenario_id) -> None:
        try:
            Scenario.objects.get(id=scenario_id)
        except Scenario.DoesNotExist as e:
            raise OneDetailedBoardingAlightingServiceError(
                message=ErrorMessages.RIDERSHIP_SCENARIO_NOT_FOUND_EN,
                status_code=404,
            ) from e

    @staticmethod
    def _convert_from_file(
        *,
        uploaded_file_bytes: bytes,
        uploaded_filename: str,
        scenario_id: str,
    ) -> BoardingAlightingConversionResult:
        try:
            df = read_uploaded_file(io.BytesIO(uploaded_file_bytes), uploaded_filename)
        except ValueError as e:
            raise OneDetailedBoardingAlightingServiceError(
                message=str(e),
                status_code=400,
            ) from e
        except Exception as e:
            raise OneDetailedBoardingAlightingServiceError(
                message=ErrorMessages.FAILED_TO_READ_FILE_TEMPLATE_EN.format(error=str(e)),
                status_code=400,
            ) from e

        boarding_alighting_rows, errors = convert_one_detailed_to_boarding_alighting(df, scenario_id)
        return BoardingAlightingConversionResult(
            boarding_alighting_rows=boarding_alighting_rows,
            errors=errors,
            total_input_rows=len(df),
            source_type="file",
        )

    @staticmethod
    def _convert_from_ridership_upload(
        *,
        user,
        ridership_upload_id,
        scenario_id: str,
    ) -> BoardingAlightingConversionResult:
        if not ridership_upload_id:
            raise OneDetailedBoardingAlightingServiceError(
                message=ErrorMessages.RIDERSHIP_UPLOAD_ID_REQUIRED_WHEN_NO_FILE_EN,
                status_code=400,
            )

        try:
            ridership_upload = RidershipUpload.objects.get(
                id=ridership_upload_id,
                scenario_id=scenario_id,
            )
        except RidershipUpload.DoesNotExist as e:
            raise OneDetailedBoardingAlightingServiceError(
                message=ErrorMessages.RIDERSHIP_UPLOAD_NOT_FOUND_EN,
                status_code=404,
            ) from e

        records = RidershipRecord.objects.filter(ridership_upload=ridership_upload)
        total_input_rows = records.count()

        if total_input_rows == 0:
            raise OneDetailedBoardingAlightingServiceError(
                message=ErrorMessages.NO_RIDERSHIP_RECORDS_FOR_UPLOAD_EN,
                status_code=400,
            )

        boarding_alighting_rows, errors = convert_ridership_records_to_boarding_alighting(records, scenario_id)
        return BoardingAlightingConversionResult(
            boarding_alighting_rows=boarding_alighting_rows,
            errors=errors,
            total_input_rows=total_input_rows,
            source_type="ridership_upload",
        )
