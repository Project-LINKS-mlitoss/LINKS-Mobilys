# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets

from gtfs.models import Scenario, Stops
from gtfs.serializers.request.stop_request import (
    StopEditCreateRequestSerializer,
    StopEditRequestSerializer,
    StopEditUpdateRequestSerializer,
    StopIdKeywordPartialUpdateSerializer,
    StopIdKeywordUpdateSerializer,
    StopNameKeywordsPartialUpdateSerializer,
    StopNameKeywordsUpdateSerializer,
    StopScenarioIdRequestSerializer,
    StopsGroupingDataUpdateRequestSerializer,
    StopsGroupingMethodUpdateRequestSerializer,
    StopsGroupDataCreateRequestSerializer,
)
from gtfs.serializers.response.scenario_response import ScenarioLocalSerializer
from gtfs.serializers.response.stop_response import StopSerializer
from gtfs.serializers.response.stop_views_response import (
    StopEditCreateResponseDataSerializer,
    StopEditListGroupResponseSerializer,
    StopEditUpdateResponseDataSerializer,
    StopIdKeywordResponseDataSerializer,
    StopNameKeywordsResponseDataSerializer,
    StopsGroupingDataRetrieveResponseDataSerializer,
    StopsGroupingDataUpdateResponseDataSerializer,
    StopsGroupingMethodUpdateResponseDataSerializer,
    StopsGroupDataCreateResponseDataSerializer,
)
from gtfs.services.stop_service import (
    StopEditService,
    StopIdKeywordService,
    StopNameKeywordsService,
    StopService,
    StopsGroupingDataService,
    StopsGroupingMethodService,
    StopsGroupDataService,
)
from gtfs.views.scenario_views import ScenarioBaseViewSet
from gtfs.utils.serializer_utils import safe_serialize


class StopsGroupingDataViewSet(ScenarioBaseViewSet):
    """
    ViewSet for handling stop data.
    """

    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    def retrieve(self, request, *args, **kwargs):
        response = StopsGroupingDataService.retrieve(scenario_id=kwargs.get("pk"))
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopsGroupingDataRetrieveResponseDataSerializer, response.data["data"])
        return response

    def update(self, request, *args, **kwargs):
        request_serializer = StopsGroupingDataUpdateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopsGroupingDataService.update(scenario_id=kwargs.get("pk"), payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopsGroupingDataUpdateResponseDataSerializer, response.data["data"])
        return response


class StopsGroupingMethodViewSet(ScenarioBaseViewSet):
    """
    ViewSet for edit stop method grouping.
    """

    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    def update(self, request, *args, **kwargs):
        request_serializer = StopsGroupingMethodUpdateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopsGroupingMethodService.update(scenario_id=kwargs.get("pk"), payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopsGroupingMethodUpdateResponseDataSerializer, response.data["data"])
        return response


class StopEditViewSet(viewsets.ModelViewSet):
    queryset = Stops.objects.all()
    serializer_class = StopEditRequestSerializer

    def get_queryset(self):
        return StopEditService.get_queryset(self.kwargs.get("scenario_id"))

    def create(self, request, *args, **kwargs):
        request_serializer = StopEditCreateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopEditService.create(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopEditCreateResponseDataSerializer, response.data["data"])
        return response

    def update(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.data.get("scenario_id")
        stop_id = kwargs.get("stop_id") or request.data.get("stop_id")

        request_serializer = StopEditUpdateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopEditService.update(scenario_id=scenario_id, stop_id=stop_id, payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopEditUpdateResponseDataSerializer, response.data["data"])
        return response

    def destroy(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.data.get("scenario_id")
        stop_id = kwargs.get("stop_id") or request.data.get("stop_id")
        return StopEditService.destroy(scenario_id=scenario_id, stop_id=stop_id)

    def list(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.query_params.get("scenario_id")
        request_serializer = StopScenarioIdRequestSerializer(data={"scenario_id": scenario_id})
        request_serializer.is_valid(raise_exception=False)

        response = StopEditService.list(scenario_id=scenario_id)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopEditListGroupResponseSerializer, response.data["data"])
        return response


class StopsGroupDataViewSet(ScenarioBaseViewSet):
    """
    ViewSet for handling stop grouping data.
    """

    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer

    def create(self, request, *args, **kwargs):
        request_serializer = StopsGroupDataCreateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopsGroupDataService.create(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopsGroupDataCreateResponseDataSerializer, response.data["data"])
        return response


class StopViewSet(viewsets.ModelViewSet):
    serializer_class = StopSerializer

    def get_queryset(self):
        request_serializer = StopScenarioIdRequestSerializer(data=self.request.query_params)
        request_serializer.is_valid(raise_exception=False)
        return StopService.get_queryset(self.request.query_params.get("scenario_id"))

    def list(self, request, *args, **kwargs):
        request_serializer = StopScenarioIdRequestSerializer(data=request.query_params)
        request_serializer.is_valid(raise_exception=False)
        return StopService.list(scenario_id=request.query_params.get("scenario_id"))


class StopNameKeywordsUpdateViewSet(ScenarioBaseViewSet):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer
    lookup_url_kwarg = "stop_group_id"

    def update(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.query_params.get("scenario_id") or request.data.get("scenario_id")
        request_serializer = StopNameKeywordsUpdateSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopNameKeywordsService.update(
            scenario_id=scenario_id,
            stop_group_id=kwargs.get("stop_group_id"),
            payload=request.data,
        )
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopNameKeywordsResponseDataSerializer, response.data["data"])
        return response

    def partial_update(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.query_params.get("scenario_id") or request.data.get("scenario_id")
        request_serializer = StopNameKeywordsPartialUpdateSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopNameKeywordsService.partial_update(
            scenario_id=scenario_id,
            stop_group_id=kwargs.get("stop_group_id"),
            payload=request.data,
        )
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopNameKeywordsResponseDataSerializer, response.data["data"])
        return response


class StopIdKeywordUpdateViewSet(ScenarioBaseViewSet):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioLocalSerializer
    lookup_url_kwarg = "stop_group_id"

    def update(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.query_params.get("scenario_id") or request.data.get("scenario_id")
        request_serializer = StopIdKeywordUpdateSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopIdKeywordService.update(
            scenario_id=scenario_id,
            stop_group_id=kwargs.get("stop_group_id"),
            payload=request.data,
        )
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopIdKeywordResponseDataSerializer, response.data["data"])
        return response

    def partial_update(self, request, *args, **kwargs):
        scenario_id = kwargs.get("scenario_id") or request.query_params.get("scenario_id") or request.data.get("scenario_id")
        request_serializer = StopIdKeywordPartialUpdateSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = StopIdKeywordService.partial_update(
            scenario_id=scenario_id,
            stop_group_id=kwargs.get("stop_group_id"),
            payload=request.data,
        )
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(StopIdKeywordResponseDataSerializer, response.data["data"])
        return response
