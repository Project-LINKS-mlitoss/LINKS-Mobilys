# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from typing import Any, Optional

from rest_framework import status

from gtfs.constants import ErrorMessages
from gtfs.models import Notification
from gtfs.services.base import log_service_call


class NotificationServiceError(Exception):
    def __init__(self, *, message: str, error: Any, status_code: int):
        super().__init__(message)
        self.message = message
        self.error = error
        self.status_code = status_code


@log_service_call
class NotificationService:
    @staticmethod
    def list_notifications(*, user, limit: int = 50) -> list[dict[str, Any]]:
        try:
            notifications = (
                Notification.objects.filter(user=user)
                .order_by("-created_at")
                .values(
                    "id",
                    "message",
                    "notification_path",
                    "scenario_id",
                    "screen_menu",
                    "is_read",
                    "description",
                    "created_at",
                    "updated_at",
                )[:limit]
            )
        except Exception as e:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATIONS_FETCH_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        return [
            {
                "id": str(n["id"]),
                "message": n["message"],
                "notification_path": n["notification_path"],
                "scenario_id": str(n["scenario_id"]) if n["scenario_id"] else None,
                "screen_menu": n["screen_menu"],
                "is_read": n["is_read"],
                "description": n["description"],
                "created_at": n["created_at"],
                "updated_at": n["updated_at"],
            }
            for n in notifications
        ]

    @staticmethod
    def create_notification(*, user, payload: Any) -> str:
        try:
            notif = Notification.objects.create(
                user=user,
                message=payload.get("message"),
                notification_path=payload.get("notification_path"),
                scenario_id=payload.get("scenario_id"),
                screen_menu=payload.get("screen_menu"),
                is_read=payload.get("is_read", False),
                description=payload.get("description", ""),
            )
            return str(notif.id)
        except Exception as e:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATION_CREATE_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

    @staticmethod
    def get_notification_detail(*, user, notification_id: Optional[str]) -> dict[str, Any]:
        if not notification_id:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATION_ID_REQUIRED_EN,
                error={"message": ErrorMessages.NOTIFICATION_ID_REQUIRED_EN},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            notif = Notification.objects.filter(id=notification_id, user=user).first()
        except Exception as e:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATIONS_FETCH_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        if notif is None:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATION_NOT_FOUND_JA,
                error={"message": ErrorMessages.NOTIFICATION_NOT_FOUND_JA},
                status_code=status.HTTP_404_NOT_FOUND,
            )

        return {
            "id": str(notif.id),
            "message": notif.message,
            "notification_path": notif.notification_path,
            "scenario_id": str(notif.scenario_id) if notif.scenario_id else None,
            "screen_menu": notif.screen_menu,
            "is_read": notif.is_read,
            "description": notif.description,
            "created_at": notif.created_at,
            "updated_at": notif.updated_at,
            "error_response": notif.error_response,
        }

    @staticmethod
    def update_notification(*, user, notification_id, is_read: Any) -> None:
        try:
            notif = Notification.objects.filter(id=notification_id, user=user).first()
        except Exception as e:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATION_UPDATE_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        if notif is None:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATION_NOT_FOUND_JA,
                error={"message": ErrorMessages.NOTIFICATION_NOT_FOUND_JA},
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if is_read is not None:
            notif.is_read = is_read
        notif.save(update_fields=["is_read", "updated_at"])

    @staticmethod
    def mark_all_read(*, user) -> int:
        try:
            return Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        except Exception as e:
            raise NotificationServiceError(
                message=ErrorMessages.NOTIFICATIONS_MARK_ALL_READ_FAILED_JA,
                error={"message": str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e
