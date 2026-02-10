from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework import status

from gtfs.constants import ErrorMessages
from gtfs.services.gtfs_validation_service import ApiError, GtfsValidationApiService
from gtfs.serializers.request.gtfs_validator_request import (
    GtfsValidateRequestSerializer,
    GtfsValidationResultRequestSerializer,
)
from gtfs.serializers.response.gtfs_validator_response import (
    GtfsValidationResultResponseSerializer,
    GtfsValidationRunResponseSerializer,
)
from mobilys_BE.shared.response import BaseResponse

# Use external services 
# https://github.com/MobilityData/gtfs-validator?tab=readme-ov-file#using-the-web-based-validator
class GtfsValidationView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            serializer = GtfsValidateRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            payload = GtfsValidationApiService.run_validation(
                user=request.user,
                scenario_id=serializer.validated_data["scenario_id"],
            )
            response_serializer = GtfsValidationRunResponseSerializer(payload)
            return BaseResponse(
                data=response_serializer.data,
                message="Validation completed",
                error=None,
                status_code=status.HTTP_200_OK,
            )
        except DRFValidationError as e:
            return BaseResponse(
                data=None,
                message=ErrorMessages.VALIDATION_FAILED_EN,
                error=getattr(e, "detail", str(e)),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except ApiError as e:
            return BaseResponse(
                data=None,
                message=e.payload.get("error", ErrorMessages.VALIDATION_FAILED_EN),
                error=e.payload,
                status_code=e.status_code,
            )

    def get(self, request):
        """
        Get validation result for a scenario.

        Query params:
            scenario_id: UUID (required)
            severity: filter by severity (optional) - ERROR, WARNING, INFO
            code: filter by notice code (optional)
            is_safe: filter by safe status (optional) - true, false
            lang: language for title metadata (optional, default "ja")
        """
        try:
            request_serializer = GtfsValidationResultRequestSerializer(data=request.query_params)
            if not request_serializer.is_valid():
                return Response({"error": ErrorMessages.SCENARIO_ID_REQUIRED_EN}, status=400)

            payload = GtfsValidationApiService.get_validation_result(
                user=request.user,
                scenario_id=request_serializer.validated_data.get("scenario_id"),
                severity=request_serializer.validated_data.get("severity"),
                code=request_serializer.validated_data.get("code"),
                is_safe=request_serializer.validated_data.get("is_safe"),
                lang=request_serializer.validated_data.get("lang", "ja"),
            )
            response_serializer = GtfsValidationResultResponseSerializer(payload)
            return Response(response_serializer.data)
        except ApiError as e:
            return Response(e.payload, status=e.status_code)
