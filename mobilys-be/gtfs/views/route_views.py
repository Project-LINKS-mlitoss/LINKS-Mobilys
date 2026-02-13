# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import status, viewsets
from rest_framework.decorators import action

from gtfs.models import Scenario, RouteKeywords
from gtfs.serializers.request.route_request import (
    RouteGroupKeywordCreateRequestSerializer,
    RouteGroupKeywordDeleteRequestSerializer,
    RouteGroupKeywordRenameRequestSerializer,
    RouteKeywordDataSerializer,
    RouteKeywordUpdateColorRequestSerializer,
    RoutesGroupingApplyChangesRequestSerializer,
    RoutesGroupingDataRetrieveRequestSerializer,
)
from gtfs.serializers.response.route_grouping_response import (
    RouteGroupKeywordCreateResponseSerializer,
    RouteGroupKeywordDeleteDataResponseSerializer,
    RouteGroupKeywordRenameDataResponseSerializer,
    RouteKeywordUpdateColorResponseSerializer,
    RoutesGroupingApplyChangesDataResponseSerializer,
    RoutesGroupingDataResponseSerializer,
)
from gtfs.serializers.response.scenario_response import ScenarioLocalSerializer
from gtfs.utils.serializer_utils import safe_serialize
from gtfs.views.scenario_views import ScenarioBaseViewSet
from mobilys_BE.shared.response import BaseResponse
from gtfs.services.routes_service import (
    RouteGroupKeywordsService,
    RouteKeywordsService,
    RoutesGroupingService,
    RoutesServiceError,
)
from gtfs.constants import ErrorMessages


class RoutesGroupingDataViewSet(ScenarioBaseViewSet):

    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    def retrieve(self, request, *args, **kwargs):
        scenario = super().get_object()
        if not scenario:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            request_serializer = RoutesGroupingDataRetrieveRequestSerializer(
                data={"kw": request.query_params.get("kw") or ""}
            )
            request_serializer.is_valid(raise_exception=False)

            data = RoutesGroupingService.build_grouping_data(
                scenario_id=str(scenario.id),
                kw_param=request_serializer.validated_data.get("kw") or "",
            )
        except RoutesServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        return BaseResponse(
            data=safe_serialize(RoutesGroupingDataResponseSerializer, data),
            message="ルートグループが正常に取得されました。",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        scenario = super().get_object()
        if not scenario:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                error=ErrorMessages.SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        group_changes = request.data.get("group_changes", [])
        if not isinstance(group_changes, list):
            return BaseResponse(
                data=None,
                message=ErrorMessages.GROUP_CHANGES_MUST_BE_LIST_JA,
                error=ErrorMessages.GROUP_CHANGES_MUST_BE_LIST_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            request_serializer = RoutesGroupingApplyChangesRequestSerializer(data=request.data)
            request_serializer.is_valid(raise_exception=False)

            updated, errors = RoutesGroupingService.apply_group_changes(
                scenario_id=str(scenario.id),
                group_changes=request_serializer.validated_data.get("group_changes", group_changes),
            )
        except RoutesServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        return BaseResponse(
            data=safe_serialize(
                RoutesGroupingApplyChangesDataResponseSerializer,
                {"updated_count": len(updated), "updated_routes": updated},
            ),
            error=errors,
            message="ルートグループが正常に更新されました。",
            status_code=status.HTTP_200_OK,
        )

class RouteKeywordViewSet(viewsets.ModelViewSet):
    queryset = RouteKeywords.objects.all()
    serializer_class = RouteKeywordDataSerializer

    def update(self, request, *args, **kwargs):
        request_serializer = RouteKeywordUpdateColorRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        try:
            data = RouteKeywordsService.update_color(
                route_keyword=super().get_object(),
                color=request_serializer.validated_data.get("color", request.data.get("color")),
            )
        except RoutesServiceError as e:
            return BaseResponse(data=e.data, message=e.message, error=e.error, status_code=e.status_code)

        return BaseResponse(
            message="ルートキーワードの色が正常に更新されました。",
            data=safe_serialize(RouteKeywordUpdateColorResponseSerializer, data),
            error=None,
            status_code=status.HTTP_200_OK
        )


class RouteGroupKeywordViewSet(viewsets.ModelViewSet):
    def create(self, request):
        request_serializer = RouteGroupKeywordCreateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        validated_data = request_serializer.validated_data

        try:
            data = RouteGroupKeywordsService.create(
                scenario_id=validated_data.get("scenario_id"),
                keyword=validated_data.get("keyword"),
                color=validated_data.get("color"),
            )
        except RoutesServiceError as e:
            return BaseResponse(data=e.data, message=e.message, error=e.error, status_code=e.status_code)

        return BaseResponse(
            message="キーワードを作成しました。",
            data=safe_serialize(RouteGroupKeywordCreateResponseSerializer, data),
            error=None,
            status_code=status.HTTP_201_CREATED,
        )


    def destroy(self, request, *args, **kwargs):
        request_serializer = RouteGroupKeywordDeleteRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        try:
            result = RouteGroupKeywordsService.delete_by_id(
                scenario_id=kwargs.get("pk"),
                route_group=request_serializer.validated_data.get("keyword", request.data.get("keyword")),
            )
        except RoutesServiceError as e:
            return BaseResponse(data=e.data, message=e.message, error=e.error, status_code=e.status_code)

        return BaseResponse(
            data=safe_serialize(RouteGroupKeywordDeleteDataResponseSerializer, result.get("data") or {}),
            message=result.get("message", ""),
            error=result.get("error"),
            status_code=result.get("status_code", status.HTTP_200_OK),
        )

    def update(self, request, *args, **kwargs):
        """
        PUT /gtfs/data/routes/keyword/grouping/<pk>/
        Body: { "keyword": "新しい名称" }
        """
        request_serializer = RouteGroupKeywordRenameRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        try:
            result = RouteGroupKeywordsService.rename(
                pk=kwargs.get("pk"),
                new_name=request_serializer.validated_data.get("keyword", request.data.get("keyword")),
                allow_no_change=False,
            )
        except RoutesServiceError as e:
            return BaseResponse(data=e.data, message=e.message, error=e.error, status_code=e.status_code)

        return BaseResponse(
            data=safe_serialize(
                RouteGroupKeywordRenameDataResponseSerializer,
                {"id": result["id"], "keyword": result["keyword"]},
            ),
            message=result.get("message") or "路線グループ名を更新しました。",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=['put'], url_path=r'rename/(?P<pk>[^/.]+)')
    def rename(self, request, pk=None):
        request_serializer = RouteGroupKeywordRenameRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        try:
            result = RouteGroupKeywordsService.rename(
                pk=pk,
                new_name=request_serializer.validated_data.get("keyword", request.data.get("keyword")),
                allow_no_change=True,
            )
        except RoutesServiceError as e:
            return BaseResponse(data=e.data, message=e.message, error=e.error, status_code=e.status_code)

        return BaseResponse(
            data=safe_serialize(
                RouteGroupKeywordRenameDataResponseSerializer,
                {"id": result["id"], "keyword": result["keyword"]},
            ),
            message=result.get("message") or "路線グループ名を更新しました。",
            error=None,
            status_code=status.HTTP_200_OK,
        )
