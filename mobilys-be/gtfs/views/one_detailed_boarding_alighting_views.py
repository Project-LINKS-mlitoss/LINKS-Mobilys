"""
API view for converting OneDetailed (ridership detail) data to BoardingAlighting data.
"""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated

from gtfs.serializers.request.one_detailed_request import OneDetailedToBoardingAlightingSerializer
from gtfs.serializers.response.one_detailed_response import (
    OneDetailedConversionValidationErrorResponseSerializer,
    OneDetailedToBoardingAlightingMetadataResponseSerializer,
)
from gtfs.services.one_detailed_boarding_alighting_service import (
    OneDetailedBoardingAlightingService,
    OneDetailedBoardingAlightingServiceError,
)
from gtfs.utils.one_detailed_boarding_alighting_utils import boarding_alighting_rows_to_csv


class OneDetailedToBoardingAlightingView(APIView):
    """
    API endpoint to convert OneDetailed (ridership detail) data to BoardingAlighting 
    (boarding/alighting aggregated) data.
    
    Accepts either:
    - Excel (.xlsx, .xls) or CSV file upload with OneDetailed data
    - ridership_upload_id to convert from existing database records
    
    Input:
    - scenario_id for stop_sequence lookup
    - file: Excel/CSV file (optional, mutually exclusive with ridership_upload_id)
    - ridership_upload_id: UUID of existing RidershipUpload (optional, mutually exclusive with file)
    
    Output:
    - CSV file with BoardingAlighting data aggregated by (date, agency_id, route_id, trip_id, stop_id, stop_sequence)
    
    Conversion Logic:
    - Each input row generates 2 entries: one for boarding, one for alighting
    - Entries are aggregated by (date, agency_id, route_id, trip_id, stop_id, stop_sequence)
    - count_geton/count_getoff = number of passengers (1 per input row)
    - stop_sequence is taken from input data, or looked up from StopTimes if missing
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Convert uploaded OneDetailed file or existing RidershipUpload to BoardingAlighting CSV."""
        serializer = OneDetailedToBoardingAlightingSerializer(data=request.data)
        if not serializer.is_valid():
            error_serializer = OneDetailedConversionValidationErrorResponseSerializer(
                {"success": False, "errors": serializer.errors}
            )
            return Response(
                error_serializer.data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        scenario_id = serializer.validated_data['scenario_id']
        uploaded_file = serializer.validated_data.get('file')
        ridership_upload_id = serializer.validated_data.get('ridership_upload_id')

        try:
            uploaded_file_bytes = None
            uploaded_filename = None
            if uploaded_file:
                uploaded_filename = uploaded_file.name
                uploaded_file_bytes = uploaded_file.read()
                try:
                    uploaded_file.seek(0)
                except Exception:
                    pass

            result = OneDetailedBoardingAlightingService.convert(
                user=request.user,
                scenario_id=scenario_id,
                uploaded_file_bytes=uploaded_file_bytes,
                uploaded_filename=uploaded_filename,
                ridership_upload_id=ridership_upload_id,
            )
        except OneDetailedBoardingAlightingServiceError as e:
            return Response(
                {"success": False, "message": e.message},
                status=e.status_code,
            )

        csv_content = boarding_alighting_rows_to_csv(result.boarding_alighting_rows)
         # Add UTF-8 BOM so spreadsheet apps (especially Excel) detect UTF-8 reliably.
        csv_content_with_bom = "\ufeff" + csv_content

        response = HttpResponse(csv_content_with_bom, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="boarding_alighting_data.csv"'
        response["X-Total-Input-Rows"] = str(result.total_input_rows)
        response["X-Total-Output-Rows"] = str(len(result.boarding_alighting_rows))
        response["X-Error-Count"] = str(len(result.errors))
        response["X-Source-Type"] = result.source_type
        return response


class OneDetailedToBoardingAlightingWithMetadataView(APIView):
    """
    API endpoint to convert OneDetailed data to BoardingAlighting data,
    returning JSON response with CSV content and metadata.
    
    Accepts either:
    - Excel (.xlsx, .xls) or CSV file upload with OneDetailed data
    - ridership_upload_id to convert from existing database records
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Convert uploaded OneDetailed file or existing RidershipUpload to BoardingAlighting CSV with metadata."""
        serializer = OneDetailedToBoardingAlightingSerializer(data=request.data)
        if not serializer.is_valid():
            error_serializer = OneDetailedConversionValidationErrorResponseSerializer(
                {"success": False, "errors": serializer.errors}
            )
            return Response(
                error_serializer.data,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        scenario_id = serializer.validated_data['scenario_id']
        uploaded_file = serializer.validated_data.get('file')
        ridership_upload_id = serializer.validated_data.get('ridership_upload_id')

        try:
            uploaded_file_bytes = None
            uploaded_filename = None
            if uploaded_file:
                uploaded_filename = uploaded_file.name
                uploaded_file_bytes = uploaded_file.read()
                try:
                    uploaded_file.seek(0)
                except Exception:
                    pass

            result = OneDetailedBoardingAlightingService.convert(
                user=request.user,
                scenario_id=scenario_id,
                uploaded_file_bytes=uploaded_file_bytes,
                uploaded_filename=uploaded_filename,
                ridership_upload_id=ridership_upload_id,
            )
        except OneDetailedBoardingAlightingServiceError as e:
            return Response(
                {"success": False, "message": e.message},
                status=e.status_code,
            )

        payload = OneDetailedBoardingAlightingService.build_metadata_payload(result=result)
        response_serializer = OneDetailedToBoardingAlightingMetadataResponseSerializer(payload)
        return Response(response_serializer.data)
