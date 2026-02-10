from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action

from mobilys_BE.shared.response import BaseResponse
from simulation.serializers.request import OperatingEconomicsPatternsRequestSerializer
from simulation.serializers.response import (
    OperatingEconomicsSerializer,
    OperatingEconomicsPatternsPayloadResponseSerializer,
)
from simulation.services import OperatingEconomicsService
from simulation.constants.errors import ErrorMessages


class OperatingEconomicsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return OperatingEconomicsService.list_queryset()

    def get_serializer_class(self):
        return OperatingEconomicsSerializer

    @action(detail=False, methods=["get"], url_path="patterns")
    def patterns(self, request, *args, **kwargs):
        request_serializer = OperatingEconomicsPatternsRequestSerializer(
            data=request.query_params
        )
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

        data = OperatingEconomicsService.get_patterns(
            simulation_id=sim_id,
            simulation_input_id=sim_input_id,
            service_ids_param=svc_param,
        )

        response_serializer = OperatingEconomicsPatternsPayloadResponseSerializer(data)
        return BaseResponse(data=response_serializer.data, status_code=status.HTTP_200_OK)
