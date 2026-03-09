# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets

from gtfs.serializers.request.trip_frequency_request import (
    TripDetailCoordinatesRequestSerializer,
    TripDetailListRequestSerializer,
    TripFrequencyCreateRequestSerializer,
    TripFrequencyRetrieveRequestSerializer,
)
from gtfs.serializers.response.trip_frequency_response import (
    TripDetailCoordinatesResponseSerializer,
    TripDetailListItemResponseSerializer,
    TripFrequencyCreateResponseDataSerializer,
    TripFrequencyRetrieveGroupResponseSerializer,
)
from gtfs.services.trip_frequency_service import TripDetailService, TripFrequencyService
from gtfs.utils.serializer_utils import safe_serialize


class TripFrequencyViewSet(viewsets.GenericViewSet):
    def retrieve(self, request, *args, **kwargs):
        request_serializer = TripFrequencyRetrieveRequestSerializer(data={"scenario_id": kwargs.get("pk")})
        request_serializer.is_valid(raise_exception=False)

        response = TripFrequencyService.retrieve(scenario_id=kwargs.get("pk"))
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripFrequencyRetrieveGroupResponseSerializer, response.data["data"])
        return response

    def create(self, request, *args, **kwargs):
        request_serializer = TripFrequencyCreateRequestSerializer(data={"items": request.data})
        request_serializer.is_valid(raise_exception=False)

        response = TripFrequencyService.create(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripFrequencyCreateResponseDataSerializer, response.data["data"])
        return response


class TripDetailViewSet(viewsets.ViewSet):
    def list(self, request):
        params = request.query_params.dict()
        request_serializer = TripDetailListRequestSerializer(data=params)
        request_serializer.is_valid(raise_exception=False)

        response = TripDetailService.list(params=params)
        response.data = safe_serialize(TripDetailListItemResponseSerializer, response.data)
        return response

    def coordinates(self, request):
        params = request.query_params.dict()
        request_serializer = TripDetailCoordinatesRequestSerializer(data=params)
        request_serializer.is_valid(raise_exception=False)

        response = TripDetailService.coordinates(params=params)
        response.data = safe_serialize(TripDetailCoordinatesResponseSerializer, response.data)
        return response
