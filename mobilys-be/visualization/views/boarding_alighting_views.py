# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import json

from rest_framework.views import APIView
from rest_framework import status as http_status

from mobilys_BE.shared.response import BaseResponse
from visualization.serializers.request.boarding_alighting_serializers import (
    BoardingAlightingCheckerRequestSerializer,
    AvailableRouteKeywordsRequestSerializer,
    BoardingAlightingRoutesRequestSerializer,
    BoardingAlightingClickDetailRequestSerializer,
    SegmentStopAnalyticsRequestSerializer,
    SegmentStopAnalyticsFilterRequestSerializer,
    SegmentCatalogRequestSerializer,
)
from visualization.serializers.response.boarding_alighting_serializers import (
    BoardingAlightingCheckerResponseSerializer,
    AvailableRouteKeywordsResponseSerializer,
    BoardingAlightingRoutesResponseSerializer,
    BoardingAlightingClickDetailResponseSerializer,
    SegmentStopAnalyticsResponseSerializer,
    SegmentStopAnalyticsFilterResponseSerializer,
    SegmentCatalogResponseSerializer,
)
from visualization.services.boarding_alighting import (
    check_boarding_alighting_data,
    get_available_route_keywords,
    build_boarding_alighting_routes,
    build_boarding_alighting_click_detail,
    build_segment_stop_analytics,
    build_segment_stop_analytics_filter,
    build_segment_catalog,
)
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages


class BoardingAlightingCheckerViews(APIView):
    def post(self, request):
        body = request.data or {}
        serializer = BoardingAlightingCheckerRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = check_boarding_alighting_data(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = BoardingAlightingCheckerResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )


class AvailableRouteKeywordsView(APIView):
    def post(self, request):
        body = request.data or {}
        serializer = AvailableRouteKeywordsRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = get_available_route_keywords(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = AvailableRouteKeywordsResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )


class BoardingAlightingViews(APIView):
    def post(self, request):
        body = request.data or {}
        serializer = BoardingAlightingRoutesRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = build_boarding_alighting_routes(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = BoardingAlightingRoutesResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )


class BoardingAlightingClickDetailView(APIView):
    def post(self, request):
        body = request.data or {}
        serializer = BoardingAlightingClickDetailRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = build_boarding_alighting_click_detail(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = BoardingAlightingClickDetailResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )


class SegmentCatalogView(APIView):
    def post(self, request):
        body = request.data or {}
        serializer = SegmentCatalogRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = build_segment_catalog(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = SegmentCatalogResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )


class SegmentStopAnalyticsView(APIView):
    def post(self, request):
        body = request.data or {}
        if not body and request.query_params.get("payload"):
            try:
                body = json.loads(request.query_params["payload"])
            except Exception:
                body = {}
        serializer = SegmentStopAnalyticsRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = build_segment_stop_analytics(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = SegmentStopAnalyticsResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )


class SegmentStopAnalyticsFilterView(APIView):
    def post(self, request):
        body = request.data or {}
        if not body and request.query_params.get("payload"):
            try:
                body = json.loads(request.query_params["payload"])
            except Exception:
                body = {}
        serializer = SegmentStopAnalyticsFilterRequestSerializer(data=body)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_BODY_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data, message = build_segment_stop_analytics_filter(body)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error,
                status_code=exc.status_code,
            )
        resp = SegmentStopAnalyticsFilterResponseSerializer(data={"data": data})
        if not resp.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_RESPONSE_DATA_EN,
                error=resp.errors,
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return BaseResponse.success(
            data=data,
            message=message or Messages.SUCCESS_EN,
        )
