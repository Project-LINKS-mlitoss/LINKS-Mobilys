"""
Thin views for Ridership Upload API.

Business logic lives in `gtfs/services/ridership/`.
"""

from rest_framework.renderers import JSONRenderer
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from gtfs.renderers import CsvPassthroughRenderer, XlsxPassthroughRenderer

from gtfs.serializers.request.ridership_request import RidershipUploadRequestSerializer
from gtfs.serializers.response.ridership_response import (
    RidershipDeleteUploadResponseSerializer,
    RidershipExportErrorResponseSerializer,
    RidershipRecordListResponseSerializer,
    RidershipUploadCreateResponseSerializer,
    RidershipUploadDetailResponseSerializer,
    RidershipUploadListResponseSerializer,
    RidershipValidationFailedResponseSerializer,
)
from gtfs.services.ridership.errors import RidershipServiceError
from gtfs.services.ridership.ridership_export_service import RidershipExportService
from gtfs.services.ridership.ridership_upload_service import RidershipUploadService
from gtfs.utils.serializer_utils import safe_serialize


class RidershipUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, scenario_id: str):
        try:
            serializer = RidershipUploadRequestSerializer(data=request.data)
            if not serializer.is_valid():
                error_serializer = RidershipValidationFailedResponseSerializer(
                    {"success": False, "message": "Validation failed", "error": serializer.errors}
                )
                return Response(
                    error_serializer.data,
                    status=400,
                )

            validated_data = serializer.validated_data
            uploaded_file = validated_data["file"]
            file_bytes = uploaded_file.read()

            payload, status_code = RidershipUploadService.upload(
                user=request.user,
                scenario_id=scenario_id,
                file_bytes=file_bytes,
                filename=uploaded_file.name,
                file_size=uploaded_file.size,
                ridership_record_name=validated_data["ridership_record_name"],
                description=validated_data.get("description", ""),
                validation_mode=validated_data.get("validation_mode", "railway"),
                max_tolerance_time=request.data.get("max_tolerance_time"),
            )
            response_payload = safe_serialize(RidershipUploadCreateResponseSerializer, payload)
            return Response(response_payload, status=status_code)
        except RidershipServiceError as e:
            return Response(e.payload or {"success": False, "message": e.message}, status=e.status_code)


class RidershipUploadListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, scenario_id: str):
        try:
            payload = RidershipUploadService.list_uploads(scenario_id=scenario_id, params=request.query_params.dict())
            response_payload = safe_serialize(RidershipUploadListResponseSerializer, payload)
            return Response(response_payload)
        except RidershipServiceError as e:
            return Response(e.payload or {"success": False, "message": e.message}, status=e.status_code)


class RidershipUploadDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, scenario_id: str, upload_id: str):
        try:
            payload = RidershipUploadService.upload_detail(
                scenario_id=scenario_id,
                upload_id=upload_id,
                params=request.query_params.dict(),
            )
            response_payload = safe_serialize(RidershipUploadDetailResponseSerializer, payload)
            return Response(response_payload)
        except RidershipServiceError as e:
            return Response(e.payload or {"success": False, "message": e.message}, status=e.status_code)

    def delete(self, request, scenario_id: str, upload_id: str):
        try:
            payload = RidershipUploadService.delete_upload(scenario_id=scenario_id, upload_id=upload_id)
            response_payload = safe_serialize(RidershipDeleteUploadResponseSerializer, payload)
            return Response(response_payload)
        except RidershipServiceError as e:
            return Response(e.payload or {"success": False, "message": e.message}, status=e.status_code)


class RidershipRecordListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, scenario_id: str):
        try:
            payload = RidershipUploadService.list_records(scenario_id=scenario_id, params=request.query_params.dict())
            response_payload = safe_serialize(RidershipRecordListResponseSerializer, payload)
            return Response(response_payload)
        except RidershipServiceError as e:
            return Response(e.payload or {"success": False, "message": e.message}, status=e.status_code)


class AllRidershipUploadsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = RidershipUploadService.list_all_uploads(user=request.user, params=request.query_params.dict())
        response_payload = safe_serialize(RidershipUploadListResponseSerializer, payload)
        return Response(response_payload)


class RidershipExportView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, XlsxPassthroughRenderer, CsvPassthroughRenderer]

    def get(self, request, scenario_id: str):
        try:
            return RidershipExportService.export(scenario_id=scenario_id, params=request.query_params.dict())
        except RidershipServiceError as e:
            payload = e.payload or {"success": False, "message": e.message}
            response_payload = safe_serialize(RidershipExportErrorResponseSerializer, payload)
            return Response(response_payload, status=e.status_code)


class RidershipExportByUploadView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, XlsxPassthroughRenderer, CsvPassthroughRenderer]

    def get(self, request, scenario_id: str, upload_id: str):
        try:
            return RidershipExportService.export_by_upload(
                scenario_id=scenario_id,
                upload_id=upload_id,
                params=request.query_params.dict(),
            )
        except RidershipServiceError as e:
            payload = e.payload or {"success": False, "message": e.message}
            response_payload = safe_serialize(RidershipExportErrorResponseSerializer, payload)
            return Response(response_payload, status=e.status_code)
