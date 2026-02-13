# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
API view for converting OneDetailed (ridership detail) data to OD (Origin-Destination) data.
"""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated

from gtfs.serializers.request.one_detailed_request import OneDetailedToODSerializer
from gtfs.serializers.response.one_detailed_response import (
    OneDetailedConversionValidationErrorResponseSerializer,
    OneDetailedToODMetadataResponseSerializer,
)
from gtfs.services.one_detailed_od_service import OneDetailedODService, OneDetailedODServiceError
from gtfs.utils.one_detailed_od_utils import od_rows_to_csv


class OneDetailedToODView(APIView):
    """
    API endpoint to convert OneDetailed (ridership detail) data to OD (Origin-Destination) data.
    
    Accepts either:
    - Excel (.xlsx, .xls) or CSV file upload with OneDetailed data
    - ridership_upload_id to convert from existing database records
    
    Input:
    - scenario_id for data lookup
    - file: Excel/CSV file (optional, mutually exclusive with ridership_upload_id)
    - ridership_upload_id: UUID of existing RidershipUpload (optional, mutually exclusive with file)
    
    Output:
    - CSV file with OD data aggregated by (date, agency_id, route_id, stopid_geton, stopid_getoff)
    
    OD Data Format:
    - date: from boarding_at (YYYYMMDD format)
    - agency_id: from operating_agency_code
    - route_id: from route_id
    - stopid_geton: from boarding_station_code
    - stopid_getoff: from alighting_station_code
    - count: total records with same combination
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Convert uploaded OneDetailed file or existing RidershipUpload to OD CSV."""
        serializer = OneDetailedToODSerializer(data=request.data)
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

            result = OneDetailedODService.convert(
                user=request.user,
                scenario_id=scenario_id,
                uploaded_file_bytes=uploaded_file_bytes,
                uploaded_filename=uploaded_filename,
                ridership_upload_id=ridership_upload_id,
            )
        except OneDetailedODServiceError as e:
            return Response({"success": False, "message": e.message}, status=e.status_code)

        csv_content = od_rows_to_csv(result.od_rows)
        # Add UTF-8 BOM so spreadsheet apps (especially Excel) detect UTF-8 reliably.
        csv_content_with_bom = "\ufeff" + csv_content

        response = HttpResponse(csv_content_with_bom, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="od_data.csv"'
        response["X-Total-Input-Rows"] = str(result.total_input_rows)
        response["X-Total-Output-Rows"] = str(len(result.od_rows))
        response["X-Error-Count"] = str(len(result.errors))
        response["X-Source-Type"] = result.source_type
        return response


class OneDetailedToODWithMetadataView(APIView):
    """
    API endpoint to convert OneDetailed data to OD (Origin-Destination) data,
    returning JSON response with CSV content and metadata.
    
    Accepts either:
    - Excel (.xlsx, .xls) or CSV file upload with OneDetailed data
    - ridership_upload_id to convert from existing database records
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Convert uploaded OneDetailed file or existing RidershipUpload to OD CSV with metadata."""
        serializer = OneDetailedToODSerializer(data=request.data)
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

            result = OneDetailedODService.convert(
                user=request.user,
                scenario_id=scenario_id,
                uploaded_file_bytes=uploaded_file_bytes,
                uploaded_filename=uploaded_filename,
                ridership_upload_id=ridership_upload_id,
            )
        except OneDetailedODServiceError as e:
            return Response({"success": False, "message": e.message}, status=e.status_code)

        payload = OneDetailedODService.build_metadata_payload(result=result)
        response_serializer = OneDetailedToODMetadataResponseSerializer(payload)
        return Response(response_serializer.data)
