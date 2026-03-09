# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.exceptions import ValidationError as DRFValidationError
from mobilys_BE.shared.response import BaseResponse
from rest_framework.views import APIView

from gtfs.constants import ErrorMessages
from gtfs.serializers.request.gtfs_safe_notices_request import (
    BulkUpsertSafeNoticeRulesSerializer,
    SafeNoticeRuleListRequestSerializer,
)
from gtfs.serializers.response.gtfs_safe_notices_response import (
    BulkUpsertSafeNoticeRulesResponseSerializer,
    SafeNoticeRuleListSerializer,
)
from gtfs.services.gtfs_safe_notices_service import GtfsSafeNoticesService

class GtfsSafeNoticeRuleListCreateApi(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request) -> BaseResponse:
        request_serializer = SafeNoticeRuleListRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_IS_ACTIVE_VALUE_EN,
                error=ErrorMessages.INVALID_IS_ACTIVE_VALUE_EN,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        qs = GtfsSafeNoticesService.list_rules(
            severity=request_serializer.validated_data.get("severity") or None,
            is_active=request_serializer.validated_data.get("is_active"),
        )
        response_serializer = SafeNoticeRuleListSerializer(qs, many=True)
        return BaseResponse(
            data=response_serializer.data,
            status_code=status.HTTP_200_OK,
            message="Safe notice rules fetched successfully.",
        )

    def post(self, request) -> BaseResponse:
        try:
            payload = BulkUpsertSafeNoticeRulesSerializer(data=request.data)
            payload.is_valid(raise_exception=True)
        except DRFValidationError as e:
            return BaseResponse(
                data=None,
                message=ErrorMessages.VALIDATION_FAILED_EN,
                error=getattr(e, "detail", str(e)),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        summary = GtfsSafeNoticesService.bulk_upsert_rules(rules=payload.validated_data["rules"])
        response_serializer = BulkUpsertSafeNoticeRulesResponseSerializer(summary)
        return BaseResponse(
            data=response_serializer.data,
            status_code=status.HTTP_200_OK,
            message="Safe notice rules upserted successfully.",
        )
