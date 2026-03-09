# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets
from rest_framework.decorators import action

from gtfs.models import Scenario
from gtfs.serializers.request.scenario_request import (
    CloneScenarioSerializer,
    ScenarioAPICreateRequestSerializer,
    ScenarioLocalCreateRequestSerializer,
    ScenarioUpdateSerializer,
)
from gtfs.serializers.request.scenario_views_request import (
    ScenarioDuplicationCandidatesRequestSerializer,
    ScenarioExportGtfsRequestSerializer,
    ScenarioListRequestSerializer,
    ScenarioRetrieveRequestSerializer,
)
from gtfs.serializers.response.scenario_response import ScenarioAPISerializer, ScenarioLocalSerializer
from gtfs.serializers.response.scenario_views_response import (
    ScenarioCloneDataResponseSerializer,
    ScenarioDuplicationCandidatesDataResponseSerializer,
    ScenarioEditContextDataResponseSerializer,
    ScenarioGraphStatusDataResponseSerializer,
    ScenarioImportResultDataResponseSerializer,
    ScenarioLocalListItemResponseSerializer,
    ScenarioRetrieveDataResponseSerializer,
    ScenarioUpdateDataResponseSerializer,
)
from gtfs.services.scenario_service import ScenarioAPIService, ScenarioLocalService
from gtfs.utils.serializer_utils import safe_serialize
from mobilys_BE.shared.response import BaseResponse


class ScenarioBaseViewSet(viewsets.ModelViewSet):
    pass


def _rebuild_base_response(service_response, *, data_serializer=None):
    if not hasattr(service_response, "data") or not hasattr(service_response, "status_code"):
        return service_response
    if not isinstance(getattr(service_response, "data", None), dict):
        return service_response

    payload = service_response.data
    data = payload.get("data")
    if data_serializer is not None and data is not None:
        data = safe_serialize(data_serializer, data)

    return BaseResponse(
        data=data,
        message=payload.get("message", ""),
        error=payload.get("error"),
        status_code=service_response.status_code,
    )


class ScenarioLocalViewSet(ScenarioBaseViewSet):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    def get_queryset(self):
        return ScenarioLocalService.get_queryset(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        resp = ScenarioLocalService.destroy(user=request.user, pk=kwargs.get("pk"))
        return _rebuild_base_response(resp)

    def update(self, request, *args, **kwargs):
        ScenarioUpdateSerializer(data=request.data).is_valid(raise_exception=False)
        resp = ScenarioLocalService.update(user=request.user, pk=kwargs.get("pk"), payload=request.data)
        return _rebuild_base_response(resp, data_serializer=ScenarioUpdateDataResponseSerializer)

    def partial_update(self, request, *args, **kwargs):
        ScenarioUpdateSerializer(data=request.data, partial=True).is_valid(raise_exception=False)
        resp = ScenarioLocalService.partial_update(user=request.user, pk=kwargs.get("pk"), payload=request.data)
        return _rebuild_base_response(resp, data_serializer=ScenarioUpdateDataResponseSerializer)

    def list(self, request, *args, **kwargs):
        ScenarioListRequestSerializer(data=request.query_params).is_valid(raise_exception=False)
        resp = ScenarioLocalService.list(user=request.user, params=request.query_params.dict())
        return _rebuild_base_response(resp, data_serializer=ScenarioLocalListItemResponseSerializer)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["gtfs_zip"] = request.FILES.get("gtfs_zip") or data.get("gtfs_zip")
        ScenarioLocalCreateRequestSerializer(data=data).is_valid(raise_exception=False)
        resp = ScenarioLocalService.create(user=request.user, payload=request.data, files=request.FILES)
        return _rebuild_base_response(resp, data_serializer=ScenarioImportResultDataResponseSerializer)

    def retrieve(self, request, *args, **kwargs):
        ScenarioRetrieveRequestSerializer(data=request.query_params).is_valid(raise_exception=False)
        resp = ScenarioLocalService.retrieve(user=request.user, pk=kwargs.get("pk"), params=request.query_params.dict())
        return _rebuild_base_response(resp, data_serializer=ScenarioRetrieveDataResponseSerializer)

    @action(detail=False, methods=["post"], url_path="clone")
    def clone(self, request):
        CloneScenarioSerializer(data=request.data).is_valid(raise_exception=False)
        resp = ScenarioLocalService.clone(user=request.user, payload=request.data)
        return _rebuild_base_response(resp, data_serializer=ScenarioCloneDataResponseSerializer)

    @action(detail=True, methods=["get"], url_path="duplication-candidates")
    def duplication_candidates(self, request, pk=None):
        ScenarioDuplicationCandidatesRequestSerializer(data=request.query_params).is_valid(raise_exception=False)
        resp = ScenarioLocalService.duplication_candidates(user=request.user, pk=pk, params=request.query_params.dict())
        return _rebuild_base_response(resp, data_serializer=ScenarioDuplicationCandidatesDataResponseSerializer)

    @action(detail=True, methods=["get"], url_path="get_graph_status")
    def get_graph_status(self, request, *args, **kwargs):
        resp = ScenarioLocalService.get_graph_status(user=request.user, pk=kwargs.get("pk"))
        return _rebuild_base_response(resp, data_serializer=ScenarioGraphStatusDataResponseSerializer)

    @action(detail=True, methods=["post"], url_path="export_gtfs")
    def export_gtfs(self, request, pk=None):
        ScenarioExportGtfsRequestSerializer(data=request.data).is_valid(raise_exception=False)
        resp = ScenarioLocalService.export_gtfs(scenario_id=pk, payload=request.data)
        return resp

    @action(detail=True, methods=["get"], url_path="edit-context")
    def edit_context(self, request, *args, **kwargs):
        resp = ScenarioLocalService.edit_context(pk=kwargs.get("pk"))
        return _rebuild_base_response(resp, data_serializer=ScenarioEditContextDataResponseSerializer)


class ScenarioAPIViewSet(ScenarioBaseViewSet):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioAPISerializer

    def get_queryset(self):
        return ScenarioAPIService.get_queryset(user=self.request.user)

    def create(self, request, *args, **kwargs):
        ScenarioAPICreateRequestSerializer(data=request.data).is_valid(raise_exception=False)
        resp = ScenarioAPIService.create(user=request.user, payload=request.data)
        return _rebuild_base_response(resp, data_serializer=ScenarioImportResultDataResponseSerializer)
