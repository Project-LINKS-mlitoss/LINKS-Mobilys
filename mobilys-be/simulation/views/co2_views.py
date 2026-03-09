# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.decorators import action

from mobilys_BE.shared.response import BaseResponse
from simulation.models import CO2Reduction
from simulation.serializers.request import (
    CO2ListRequestSerializer,
    CO2PatternsRequestSerializer,
    CO2TotalsRequestSerializer,
)
from simulation.serializers.response import (
    CO2ReductionByRouteSerializer,
    CO2PatternsPayloadResponseSerializer,
    CO2TotalsResponseSerializer,
)
from simulation.services import CO2Service
from simulation.constants.errors import ErrorMessages


class CO2ByRouteViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        request_serializer = CO2ListRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            if "simulation" in request_serializer.errors:
                return BaseResponse.bad_request(
                    error="missing_required_param",
                    message=ErrorMessages.QUERY_PARAMETER_SIMULATION_REQUIRED,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )
        sim_id = request_serializer.validated_data.get("simulation")
        sim_input = request_serializer.validated_data.get("simulation_input")
        qs = CO2Service.list_queryset(
            user=request.user,
            simulation_id=sim_id,
            simulation_input_id=sim_input,
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            response_serializer = CO2ReductionByRouteSerializer(page, many=True)
            return BaseResponse.success(data=response_serializer.data)
        response_serializer = CO2ReductionByRouteSerializer(qs, many=True)
        return BaseResponse.success(data=response_serializer.data)

    @action(detail=False, methods=["get"], url_path="patterns")
    def patterns(self, request, *args, **kwargs):
        request_serializer = CO2PatternsRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.SIMULATION_REQUIRED,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )
        sim_id = request_serializer.validated_data.get("simulation_id")

        sim_input_id = request_serializer.validated_data.get("simulation_input")
        svc_param = request_serializer.validated_data.get("service_ids")

        data = CO2Service.get_patterns(
            simulation_id=sim_id,
            simulation_input_id=sim_input_id,
            service_ids_param=svc_param,
        )

        response_serializer = CO2PatternsPayloadResponseSerializer(data)
        return BaseResponse.success(data=response_serializer.data)

class CO2TotalsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        request_serializer = CO2TotalsRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            if "simulation" in request_serializer.errors:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.QUERY_PARAMETER_SIMULATION_REQUIRED,
                    error="missing_required_param",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        sim_id = request_serializer.validated_data.get("simulation")
        sim_input = request_serializer.validated_data.get("simulation_input")
        data = CO2Service.get_totals(simulation_id=sim_id, simulation_input_id=sim_input)
        response_serializer = CO2TotalsResponseSerializer(data)
        return BaseResponse.success(data=response_serializer.data)
