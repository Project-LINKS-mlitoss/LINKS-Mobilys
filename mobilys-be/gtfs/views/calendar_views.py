# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets, status
from mobilys_BE.shared.response import BaseResponse
from gtfs.serializers.request.calendar_request import CalendarServiceIdsRequestSerializer
from gtfs.serializers.response.calendar_response import CalendarSerializer, CalendarServiceIdsResponseSerializer
from gtfs.models import Calendar
from gtfs.services.calendar_service import CalendarService, CalendarServiceError
from gtfs.constants import ErrorMessages

class CalendarViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarSerializer

    def get_queryset(self):
        scenario_id = self.request.query_params.get('scenario_id')
        if scenario_id:
            return Calendar.objects.filter(scenario_id=scenario_id)
        return Calendar.objects.none()

    def list(self, request, *args, **kwargs):
        request_serializer = CalendarServiceIdsRequestSerializer(data=request.query_params)
        if not request_serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        scenario_id = request_serializer.validated_data.get("scenario_id")

        try:
            service_ids = CalendarService.list_service_ids(scenario_id=scenario_id)
        except CalendarServiceError as e:
            return BaseResponse(
                data=None,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        response_serializer = CalendarServiceIdsResponseSerializer({"service_ids": list(service_ids)})
        return BaseResponse(
            data=response_serializer.data["service_ids"],
            message="カレンダーリストを読むことが完了しました",
            error=None,
            status_code=status.HTTP_200_OK,
        )
