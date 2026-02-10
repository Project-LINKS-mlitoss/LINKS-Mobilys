from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from mobilys_BE.shared.response import BaseResponse
from simulation.models import SegmentSpeedMetrics
from simulation.serializers.request import SegmentSpeedMetricsListRequestSerializer
from simulation.serializers.response import SegmentSpeedMetricsPayloadResponseSerializer
from simulation.services import SegmentSpeedMetricsService, NotFoundError
from simulation.constants.errors import ErrorMessages


class SegmentSpeedMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SegmentSpeedMetrics.objects.none()

    def list(self, request, *args, **kwargs):
        request_serializer = SegmentSpeedMetricsListRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            if "simulation" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message="",
                    error=ErrorMessages.QUERY_PARAM_SIMULATION_REQUIRED,
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        sim_id = request_serializer.validated_data.get("simulation")
        override_service_id = request_serializer.validated_data.get("service_id") or None
        car_change_number_raw = request_serializer.validated_data.get(
            "car_change_number"
        )
        car_change_number = None
        if car_change_number_raw not in (None, ""):
            try:
                car_change_number = float(car_change_number_raw)
            except (TypeError, ValueError):
                car_change_number = None

        try:
            payload = SegmentSpeedMetricsService.get_payload(
                simulation_id=sim_id,
                service_id=override_service_id,
                car_change_number=car_change_number,
            )
        except NotFoundError as e:
            return BaseResponse.not_found(
                message="",
                error=e.message,
            )

        response_serializer = SegmentSpeedMetricsPayloadResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="",
        )
