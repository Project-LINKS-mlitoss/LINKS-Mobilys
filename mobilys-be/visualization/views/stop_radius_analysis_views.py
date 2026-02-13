# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# views_stop_group_buffers.py
from rest_framework.views import APIView
from rest_framework import status as http_status

from mobilys_BE.shared.response import BaseResponse
from visualization.serializers.request.stop_radius_analysis_serializers import (
    StopGroupBufferAnalysisRequestSerializer,
    StopGroupBufferAnalysisGraphRequestSerializer,
)
from visualization.serializers.response.stop_radius_analysis_serializers import (
    StopGroupBufferAnalysisResponseSerializer,
    StopGroupBufferAnalysisGraphResponseSerializer,
)
from visualization.services.base import ServiceError
from visualization.services.stop_radius_analysis import (
    build_stop_group_buffer_payload,
    build_stop_group_graph_payload,
)
from visualization.utils.share_util import normalize_project_id as _normalize_project_id
from visualization.constants.messages import Messages


class StopGroupBufferAnalysisPostGIS(APIView):
    def post(self, request):
        serializer = StopGroupBufferAnalysisRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        radius = float(params.get("radius"))
        dissolve = (params.get("dissolve") or "global").lower()
        outline_only = bool(params.get("outline_only") or False)

        try:
            fc = build_stop_group_buffer_payload(
                scenario_id=str(scenario_id),
                radius=radius,
                dissolve=dissolve,
                outline_only=outline_only,
            )
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        except Exception as exc:
            return BaseResponse.error(
                message=Messages.FAILED_TO_BUILD_STOP_BUFFERS_EN,
                error=str(exc),
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        result = {"radius": fc}
        response_serializer = StopGroupBufferAnalysisResponseSerializer(data=result)
        if not response_serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                error=response_serializer.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse.success(
            data=result,
            message=Messages.STOP_BUFFERS_COMPUTED_SUCCESSFULLY_EN,
            status_code=http_status.HTTP_200_OK,
        )


class StopGroupBufferAnalysisGraph(APIView):
    def post(self, request):
        serializer = StopGroupBufferAnalysisGraphRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        radius = float(params.get("radius"))
        project_id = _normalize_project_id(params.get("project_id"))

        try:
            result = build_stop_group_graph_payload(
                scenario_id=str(scenario_id),
                radius=radius,
                user=request.user,
                project_id=project_id,
            )
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        except Exception as exc:
            return BaseResponse.error(
                message=Messages.FAILED_TO_BUILD_STOP_BUFFER_GRAPH_EN,
                error=str(exc),
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response_serializer = StopGroupBufferAnalysisGraphResponseSerializer(data=result)
        if not response_serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                error=response_serializer.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse.success(
            data=result,
            message=Messages.STOP_BUFFER_GRAPH_COMPUTED_SUCCESSFULLY_EN,
            status_code=http_status.HTTP_200_OK,
        )
