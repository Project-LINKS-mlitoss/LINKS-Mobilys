# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from mobilys_BE.shared.response import BaseResponse
from simulation.serializers.response import (
    BenefitCalculationsPayloadResponseSerializer,
)
from simulation.serializers.request import BenefitCalculationsListRequestSerializer
from simulation.services import BenefitCalculationsService, NotFoundError
from simulation.constants.errors import ErrorMessages


class BenefitCalculationsViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        request_serializer = BenefitCalculationsListRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            if "simulation" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.QUERY_PARAM_SIMULATION_REQUIRED,
                    error=request_serializer.errors["simulation"][0],
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        sim_id = request_serializer.validated_data.get("simulation")

        try:
            payload = BenefitCalculationsService.get_payload(sim_id)
        except NotFoundError as e:
            return BaseResponse.not_found(
                message=e.message,
                error=e.error,
            )

        response_serializer = BenefitCalculationsPayloadResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="Benefit calculations payload retrieved successfully",
        )
    
