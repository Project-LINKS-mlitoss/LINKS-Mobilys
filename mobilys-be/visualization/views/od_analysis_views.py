from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import status as http_status

from mobilys_BE.shared.response import BaseResponse
from visualization.serializers.request.od_analysis_serializers import (
    ODBusStopRequestSerializer,
    ODLastFirstStopRequestSerializer,
    ODUploadRequestSerializer,
    ODUsageDistributionRequestSerializer,
)
from visualization.services.od_analysis import (
    build_bus_stop_payload,
    build_last_first_stop_payload,
    build_upload_payload,
    build_usage_distribution_payload,
)
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages


class ODUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ODUploadRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        od_data = params.get("od_data")

        try:
            result_data = build_upload_payload(scenario_id, od_data)
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error or exc.message,
                status_code=exc.status_code,
            )

        response = BaseResponse.success(
            message=Messages.OD_UPLOAD_VALIDATED_SUCCESSFULLY_EN,
            data=None,
            status_code=http_status.HTTP_200_OK,
        )
        response.data = result_data
        return response


class ODUsageDistributionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ODUsageDistributionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        od_data = params.get("od_data")
        selected_date = params.get("selected_date")

        try:
            result_data = build_usage_distribution_payload(
                scenario_id=scenario_id,
                od_data=od_data,
                selected_date=selected_date,
            )
        except ServiceError as exc:
            return BaseResponse.error(
                message=exc.message,
                error=exc.error or exc.message,
                status_code=exc.status_code,
            )

        response = BaseResponse.success(
            message=Messages.OD_USAGE_DISTRIBUTION_RETRIEVED_SUCCESSFULLY_EN,
            data=None,
            status_code=http_status.HTTP_200_OK,
        )
        response.data = result_data
        return response


class ODLastStopAndFirstStopAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ODLastFirstStopRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        od_data = params.get("od_data")
        selected_date = params.get("selected_date")
        stop_type = params.get("type")

        result_data = build_last_first_stop_payload(
            scenario_id=scenario_id,
            od_data=od_data,
            selected_date=selected_date,
            stop_type=stop_type,
        )

        response = BaseResponse.success(
            message=Messages.OD_LAST_FIRST_STOP_RETRIEVED_SUCCESSFULLY_EN,
            data=None,
            status_code=http_status.HTTP_200_OK,
        )
        response.data = result_data
        return response


class ODBusStopAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ODBusStopRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_REQUEST_PAYLOAD_EN,
                error=serializer.errors,
                status_code=http_status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        od_data = params.get("od_data")
        selected_date = params.get("selected_date")

        result_data = build_bus_stop_payload(
            scenario_id=scenario_id,
            od_data=od_data,
            selected_date=selected_date,
        )

        response = BaseResponse.success(
            message=Messages.OD_BUS_STOP_DATA_RETRIEVED_SUCCESSFULLY_EN,
            data=None,
            status_code=http_status.HTTP_200_OK,
        )
        response.data = result_data
        return response
