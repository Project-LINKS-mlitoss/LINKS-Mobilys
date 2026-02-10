import logging
from rest_framework.views import APIView
from rest_framework import status

from mobilys_BE.shared.response import BaseResponse
from simulation.models import Simulation
from simulation.serializers.request import SimulationSummaryRequestSerializer
from simulation.serializers.response import SimulationSummaryResponseSerializer
from simulation.services import SimulationSummaryService, CarRoutingService, BenefitCalculationsService
from mobilys_BE.shared.log_json import log_json
from simulation.constants.errors import ErrorMessages

logger = logging.getLogger(__name__)


class SimulationSummaryView(APIView):
    def get(self, request, *args, **kwargs):
        request_serializer = SimulationSummaryRequestSerializer(
            data=request.query_params
        )
        if not request_serializer.is_valid():
            if "simulation_id" in request_serializer.errors:
                return BaseResponse.bad_request(
                    message=ErrorMessages.SIMULATION_ID_QUERY_REQUIRED,
                    error="missing_simulation_id",
                )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors,
            )

        simulation_id = request_serializer.validated_data.get("simulation_id")

        summary = SimulationSummaryService.get_summary(simulation_id)

        try:
            sim = Simulation.objects.get(pk=simulation_id)
            car_volume_payload, has_car_volume = CarRoutingService.get_car_volume(sim)
        except Exception:
            log_json(
                logger,
                logging.ERROR,
                "simulation_summary_car_volume_failed",
                simulation_id=str(simulation_id),
            )
            return BaseResponse.internal_error(
                message=ErrorMessages.FAILED_CAR_VOLUME,
                error="car_volume_failed",
            )

        try:
            benefit_payload = BenefitCalculationsService.get_payload(simulation_id)
        except Exception:
            log_json(
                logger,
                logging.ERROR,
                "simulation_summary_benefit_calculations_failed",
                simulation_id=str(simulation_id),
            )
            return BaseResponse.internal_error(
                message=ErrorMessages.FAILED_BENEFIT_CALCULATIONS,
                error="benefit_calculations_failed",
            )

        car_volume_data = {
            "data": car_volume_payload,
            "message": "OK" if has_car_volume else ErrorMessages.NO_DATA_MESSAGE,
            "error": None,
        }

        benefit_data = {
            "data": benefit_payload,
            "message": "",
            "error": None,
        }

        payload = {
            "ridership_change_data": summary["ridership_change_data"],
            "operating_economics_data": summary["operating_economics_data"],
            "car_volume_data": car_volume_data,
            "segment_speed_metrics_data": summary["segment_speed_metrics_data"],
            "benefit_calculations": benefit_data,
            "co2_reduction": summary["co2_reduction"],
        }

        response_serializer = SimulationSummaryResponseSerializer(payload)
        return BaseResponse.success(
            data=response_serializer.data,
            message="GET endpoint for simulation summary.",
        )
