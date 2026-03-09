# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from mobilys_BE.shared.response import BaseResponse
from gtfs.serializers.request.notification_request import (
    NotificationCreateRequestSerializer,
    NotificationDetailRequestSerializer,
    NotificationUpdateRequestSerializer,
)
from gtfs.serializers.response.notification_response import (
    NotificationCreateResponseSerializer,
    NotificationDetailResponseSerializer,
    NotificationListItemResponseSerializer,
    NotificationMarkAllReadResponseSerializer,
    NotificationUpdateResponseSerializer,
)
from gtfs.services.notification_service import NotificationService, NotificationServiceError

class NotificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            data = NotificationService.list_notifications(user=request.user, limit=50)
        except NotificationServiceError as e:
            return BaseResponse(
                data=None,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        response_serializer = NotificationListItemResponseSerializer(data, many=True)
        return BaseResponse(
            data=response_serializer.data,
            message="Notifications retrieved successfully.",
            error=None,
        )


    def post(self, request):
        NotificationCreateRequestSerializer(data=request.data).is_valid(raise_exception=False)
        try:
            notif_id = NotificationService.create_notification(user=request.user, payload=request.data)
            response_serializer = NotificationCreateResponseSerializer({"id": notif_id})
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except NotificationServiceError as e:
            return BaseResponse(
                data=None,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )


class NotificationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        request_serializer = NotificationDetailRequestSerializer(data=request.query_params)
        request_serializer.is_valid(raise_exception=False)
        try:
            data = NotificationService.get_notification_detail(
                user=request.user,
                notification_id=request_serializer.validated_data.get("notification_id")
                or request.query_params.get("notification_id"),
            )
        except NotificationServiceError as e:
            return BaseResponse(
                data=None,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        response_serializer = NotificationDetailResponseSerializer(data)
        return BaseResponse(
            data=response_serializer.data,
            message="Notification detail retrieved successfully.",
            error=None,
        )

class NotificationUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        NotificationUpdateRequestSerializer(data=request.data).is_valid(raise_exception=False)
        try:
            NotificationService.update_notification(
                user=request.user,
                notification_id=pk,
                is_read=request.data.get("is_read", None),
            )
            response_serializer = NotificationUpdateResponseSerializer({"message": "Notification updated."})
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except NotificationServiceError as e:
            return BaseResponse(
                data=None,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            updated_count = NotificationService.mark_all_read(user=request.user)
            response_serializer = NotificationMarkAllReadResponseSerializer({"updated_count": updated_count})
            return BaseResponse(
                data=response_serializer.data,
                message="All notifications marked as read.",
                error=None
            )
        except NotificationServiceError as e:
            return BaseResponse(
                data=None,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )
