# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from mobilys_BE.shared.response import BaseResponse
from simulation.serializers.request import (
    RCDefaultsQuerySerializer,
    RCCalcInputSerializer,
    RCChangedRoutesQuerySerializer,
    RidershipChangeListRequestSerializer,
    RidershipChangePatternsRequestSerializer,
)
from simulation.serializers.response import (
    RidershipChangeListSerializer,
    RidershipChangeDefaultsResponseSerializer,
    RidershipChangeCalcResponseSerializer,
    RidershipChangeChangedRouteSerializer,
    RidershipChangePatternsPayloadResponseSerializer,
)
from simulation.services import RidershipChangeService, NotFoundError, ValidationError
from simulation.constants.errors import ErrorMessages


class RidershipChangeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RidershipChangeService.list_changes()

    def get_serializer_class(self):
        return RidershipChangeListSerializer

    def list(self, request, *args, **kwargs):
        request_serializer = RidershipChangeListRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            return BaseResponse(
                data=request_serializer.errors,
                message=ErrorMessages.INVALID_QUERY,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        sim_id = request_serializer.validated_data.get("simulation")
        day_type = request_serializer.validated_data.get("day_type")

        qs = RidershipChangeService.list_changes(simulation_id=sim_id, day_type=day_type)
        response_serializer = RidershipChangeListSerializer(qs, many=True)
        return BaseResponse.success(data=response_serializer.data, message="")

    @action(detail=False, methods=["get"], url_path="defaults")
    def defaults(self, request: Request):
        q = RCDefaultsQuerySerializer(data=request.query_params)
        if not q.is_valid():
            return BaseResponse(q.errors, ErrorMessages.INVALID_QUERY, status.HTTP_400_BAD_REQUEST)

        simulation_id = q.validated_data["simulation"]
        route_id = q.validated_data["route_id"]
        day_type = q.validated_data["day_type"]
        service_id = q.validated_data.get("service_id") or None

        try:
            data = RidershipChangeService.get_defaults(
                simulation_id=simulation_id,
                route_id=route_id,
                day_type=day_type,
                service_id=service_id,
            )
        except NotFoundError:
            return BaseResponse(None, ErrorMessages.SIMULATION_NOT_FOUND, status.HTTP_404_NOT_FOUND)

        response_serializer = RidershipChangeDefaultsResponseSerializer(data)
        return BaseResponse.success(data=response_serializer.data, message="")

    @action(detail=False, methods=["post"], url_path="calc")
    def calc(self, request: Request):
        s = RCCalcInputSerializer(data=request.data)
        if not s.is_valid():
            return BaseResponse(s.errors, ErrorMessages.INVALID_BODY, status.HTTP_400_BAD_REQUEST)
        v = s.validated_data

        try:
            data = RidershipChangeService.calculate(
                simulation_id=v["simulation"],
                route_id=v["route_id"],
                day_type=v["day_type"],
                baseline_riders_per_day=v["baseline_riders_per_day"],
                baseline_trips_per_day=v["baseline_trips_per_day"],
                delta_trips_per_day=v["delta_trips_per_day"],
                sensitivity_epsilon=v["sensitivity_epsilon"],
            )
        except ValidationError as e:
            return BaseResponse(
                data=e.details or e.message,
                message=ErrorMessages.INVALID_BODY,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except NotFoundError:
            return BaseResponse(None, ErrorMessages.SIMULATION_NOT_FOUND, status.HTTP_404_NOT_FOUND)

        response_serializer = RidershipChangeCalcResponseSerializer(data)
        return BaseResponse.success(data=response_serializer.data, message="")

    @action(detail=False, methods=["get"], url_path="changed-routes")
    def changed_routes(self, request: Request):
        q = RCChangedRoutesQuerySerializer(data=request.query_params)
        if not q.is_valid():
            return BaseResponse(q.errors, ErrorMessages.INVALID_QUERY, status.HTTP_400_BAD_REQUEST)

        simulation_id = q.validated_data["simulation"]
        service_id = q.validated_data["service_id"]

        try:
            data, scenarios_missing = RidershipChangeService.get_changed_routes(
                simulation_id=simulation_id,
                service_id=service_id,
            )
        except NotFoundError:
            return BaseResponse(None, ErrorMessages.SIMULATION_NOT_FOUND, status.HTTP_404_NOT_FOUND)

        if scenarios_missing:
            return BaseResponse.success(data=[], message=ErrorMessages.SCENARIOS_MISSING)

        response_serializer = RidershipChangeChangedRouteSerializer(data, many=True)
        return BaseResponse.success(data=response_serializer.data, message="OK")

    @action(detail=False, methods=["get"], url_path="patterns")
    def patterns(self, request, *args, **kwargs):
        request_serializer = RidershipChangePatternsRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.SIMULATION_REQUIRED,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return BaseResponse(
                data=request_serializer.errors,
                message=ErrorMessages.INVALID_QUERY,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        sim_id = request_serializer.validated_data.get("simulation_id")
        day_type = request_serializer.validated_data.get("day_type")
        svc_param = request_serializer.validated_data.get("service_ids")

        data = RidershipChangeService.get_patterns(
            simulation_id=sim_id,
            day_type=day_type,
            service_ids_param=svc_param,
        )

        response_serializer = RidershipChangePatternsPayloadResponseSerializer(data)
        return BaseResponse.success(data=response_serializer.data, message="")
