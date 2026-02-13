# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError

from gtfs.serializers.request.scenario_validator_request import (
    ScenarioValidateApiRequestSerializer,
    ScenarioValidateLocalRequestSerializer,
)
from gtfs.serializers.response.scenario_validator_response import (
    ScenarioValidationApiDataResponseSerializer,
    ScenarioValidationLocalDataResponseSerializer,
)
from gtfs.services.scenario_validator_service import ScenarioValidatorService
from gtfs.utils.serializer_utils import safe_serialize
from mobilys_BE.shared.response import BaseResponse
from gtfs.constants import ErrorMessages


class ScenarioValidationViewSet(viewsets.ViewSet):
    """
    ViewSet for GTFS scenario import validation before actual import process.
    Does not save data to database, only runs validation.
    """

    @action(detail=False, methods=["post"], url_path="validate-local")
    def validate_local(self, request):
        data = request.data.copy()
        data["gtfs_zip"] = request.FILES.get("gtfs_zip") or data.get("gtfs_zip")
        serializer = ScenarioValidateLocalRequestSerializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError as e:
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_REQUEST_DATA_JA,
                error={"source": "internal", "code": "validation_error", "message": str(e.detail)},
                status_code=400,
            )

        result = ScenarioValidatorService.validate_local(
            user=request.user,
            scenario_name=serializer.validated_data.get("scenario_name"),
            gtfs_zip=serializer.validated_data.get("gtfs_zip"),
        )
        if isinstance(result, dict) and isinstance(result.get("data"), dict):
            result["data"] = safe_serialize(ScenarioValidationLocalDataResponseSerializer, result["data"])
        return BaseResponse(**result)

    @action(detail=False, methods=["post"], url_path="validate-api")
    def validate_api(self, request):
        serializer = ScenarioValidateApiRequestSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError as e:
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_REQUEST_DATA_JA,
                error={"source": "internal", "code": "validation_error", "message": str(e.detail)},
                status_code=400,
            )

        validated_data = serializer.validated_data
        result = ScenarioValidatorService.validate_api(
            user=request.user,
            organization_id=validated_data.get("organization_id"),
            feed_id=validated_data.get("feed_id"),
            scenario_name=validated_data.get("scenario_name"),
            gtfs_file_uid=validated_data.get("gtfs_file_uid"),
            start_date=validated_data.get("start_date"),
            end_date=validated_data.get("end_date"),
        )
        if isinstance(result, dict) and isinstance(result.get("data"), dict):
            result["data"] = safe_serialize(ScenarioValidationApiDataResponseSerializer, result["data"])
        return BaseResponse(**result)
