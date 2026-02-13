# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework.views import APIView
from rest_framework import status

from mobilys_BE.shared.response import BaseResponse
from simulation.models import Simulation
from simulation.serializers.request import (
    CarRoutingDetailRequestSerializer,
    CarRoutingVolumeRequestSerializer,
)
from simulation.serializers.response import (
    CarRoutingDetailResponseSerializer,
    CarRoutingVolumeResponseSerializer,
)
from simulation.services import CarRoutingService
from simulation.constants.errors import ErrorMessages


class GetCarRoutingFromDBView(APIView):
    def get(self, request, *args, **kwargs):
        request_serializer = CarRoutingDetailRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.MISSING_SIMULATION_ID_MESSAGE,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        sim_id = request_serializer.validated_data.get("simulation_id")

        try:
            sim = Simulation.objects.get(pk=sim_id)
        except Simulation.DoesNotExist:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SIMULATION_NOT_FOUND_MESSAGE.format(sim_id=sim_id),
                status_code=status.HTTP_404_NOT_FOUND,
            )

        payload, has_data = CarRoutingService.get_routes_detail(sim)
        if not has_data:
            return BaseResponse.success(
                data={"routes": []},
                message=ErrorMessages.NO_DATA_MESSAGE,
            )

        response_serializer = CarRoutingDetailResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="OK",
        )


class GetCarVolumeFromDBView(APIView):
    def get(self, request, *args, **kwargs):
        request_serializer = CarRoutingVolumeRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.MISSING_SIMULATION_ID_MESSAGE,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        sim_id = request_serializer.validated_data.get("simulation_id")

        try:
            sim = Simulation.objects.get(pk=sim_id)
        except Simulation.DoesNotExist:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SIMULATION_NOT_FOUND_MESSAGE.format(sim_id=sim_id),
                status_code=status.HTTP_404_NOT_FOUND,
            )

        payload, has_data = CarRoutingService.get_car_volume(sim)
        if not has_data:
            return BaseResponse.success(
                data={"car_change_number": 0.0, "routes": []},
                message=ErrorMessages.NO_DATA_MESSAGE,
            )

        response_serializer = CarRoutingVolumeResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="OK",
        )
