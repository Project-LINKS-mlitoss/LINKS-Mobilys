# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework import status as http_status

from mobilys_BE.shared.response import BaseResponse
from visualization.serializers.request.road_network_reachability_serializers import (
    RoadNetworkReachabilityRequestSerializer,
    RoadNetworkReachabilityAnalysisRequestSerializer,
    BuildOTPGraphQuerySerializer,
    PrefectureAvailabilityQuerySerializer,
)
from visualization.serializers.response.road_network_reachability_serializers import (
    RoadNetworkReachabilityResponseSerializer,
    RoadNetworkReachabilityAnalysisResponseSerializer,
    PrefectureAvailabilityResponseSerializer,
)
from visualization.services.road_network_reachability import (
    build_analysis_payload,
    build_graph_payload,
    build_isochrone_payload,
    build_prefecture_availability_payload,
    is_isochrone_empty,
)
from visualization.services.base import ServiceError
from gtfs.models import Scenario
from visualization.constants.messages import Messages


class RoadNetworkReachability(APIView):
    def post(self, request):
        serializer = RoadNetworkReachabilityRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = build_isochrone_payload(serializer.validated_data)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        except Exception as exc:
            return BaseResponse.error(
                message=Messages.FAILED_TO_COMPUTE_ISOCHRONE_EN,
                error=str(exc),
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if is_isochrone_empty(result.get("isochrone")):
            return BaseResponse.error(
                message=Messages.NO_COVERAGE_FROM_OTP_ISOCHRONE_EN,
                error=Messages.NO_COVERAGE_FROM_OTP_ISOCHRONE_EN,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        response_serializer = RoadNetworkReachabilityResponseSerializer(data=result)
        if not response_serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                error=response_serializer.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse.success(
            data=result,
            message=Messages.ISOCHRONE_COMPUTED_SUCCESSFULLY_EN,
            status_code=http_status.HTTP_200_OK,
        )


class RoadNetworkReachabilityAnalysis(APIView):
    def post(self, request):
        serializer = RoadNetworkReachabilityAnalysisRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        isochrone_polygon = data.get("isochrone") or data.get("isochrone_geojson")
        if not isochrone_polygon:
            return BaseResponse.error(
                message=Messages.ISOCHRONE_REQUIRED_EN,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        if is_isochrone_empty(isochrone_polygon):
            return BaseResponse.error(
                message=Messages.NO_COVERAGE_FROM_OTP_ISOCHRONE_EN,
                error=Messages.NO_COVERAGE_FROM_OTP_ISOCHRONE_EN,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = build_analysis_payload(data, request.user)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        except Exception as exc:
            return BaseResponse.error(
                message=Messages.FAILED_TO_ANALYZE_ISOCHRONE_EN,
                error=str(exc),
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response_serializer = RoadNetworkReachabilityAnalysisResponseSerializer(data=result)
        if not response_serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                error=response_serializer.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse.success(
            data=result,
            message=Messages.ISOCHRONE_ANALYSIS_COMPLETED_EN,
            status_code=http_status.HTTP_200_OK,
        )


class BuildOTPGraph(APIView):
    def get(self, request, pk=None):
        serializer = BuildOTPGraphQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        graph_type = serializer.validated_data.get("graph_type")

        try:
            build_graph_payload(str(pk), graph_type, request.user)
        except Scenario.DoesNotExist:
            return BaseResponse.error(
                message=Messages.SCENARIO_NOT_FOUND_EN,
                status_code=http_status.HTTP_404_NOT_FOUND,
            )
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        except Exception as exc:
            return BaseResponse(
                data=None,
                message=Messages.FAILED_TO_BUILD_GRAPH_EN,
                error=str(exc),
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse.success(
            data=None,
            message=Messages.GRAPH_BUILD_ACCEPTED_EN,
            status_code=http_status.HTTP_200_OK,
        )


class PrefectureAvailability(APIView):
    def get(self, request, pk=None):
        payload = {
            "scenario_id": pk or request.query_params.get("scenario_id"),
            "graph_type": request.query_params.get("graph_type"),
        }
        serializer = PrefectureAvailabilityQuerySerializer(data=payload)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        scenario_id = str(serializer.validated_data.get("scenario_id") or "").strip()
        if not scenario_id:
            return BaseResponse.error(
                message=Messages.SCENARIO_ID_REQUIRED_EN,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        graph_type = serializer.validated_data.get("graph_type")
        try:
            data = build_prefecture_availability_payload(scenario_id, graph_type)
        except Scenario.DoesNotExist:
            return BaseResponse.error(
                message=Messages.SCENARIO_NOT_FOUND_EN,
                status_code=http_status.HTTP_404_NOT_FOUND,
            )
        except Exception as exc:
            return BaseResponse.error(
                message=Messages.FAILED_TO_FETCH_OTP_PBF_AVAILABILITY_EN,
                error=str(exc),
                status_code=http_status.HTTP_502_BAD_GATEWAY,
            )

        response_serializer = PrefectureAvailabilityResponseSerializer(data=data)
        if not response_serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_PAYLOAD_EN,
                error=response_serializer.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse.success(
            data=data,
            message=Messages.OK_EN,
            status_code=http_status.HTTP_200_OK,
        )


