# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from typing import Optional

from rest_framework import status

from gtfs.constants import ErrorMessages
from gtfs.models import Map
from gtfs.services.base import log_service_call


class MapServiceError(Exception):
    def __init__(self, *, message: str, error: Optional[str], status_code: int):
        super().__init__(message)
        self.message = message
        self.error = error
        self.status_code = status_code


@log_service_call
class MapService:
    @staticmethod
    def set_user_map(*, user, map_id) -> Map:
        if not map_id:
            raise MapServiceError(
                message=ErrorMessages.MAP_ID_REQUIRED_JA,
                error=ErrorMessages.MAP_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            map_obj = Map.objects.get(id=map_id)
        except Map.DoesNotExist as e:
            raise MapServiceError(
                message=ErrorMessages.MAP_NOT_FOUND_MESSAGE_JA,
                error=ErrorMessages.MAP_NOT_FOUND_ERROR_JA,
                status_code=status.HTTP_404_NOT_FOUND,
            ) from e

        try:
            profile = user.profile
            profile.map = map_obj
            profile.save()
        except Exception as e:
            raise MapServiceError(
                message=ErrorMessages.MAP_UPDATE_FAILED_MESSAGE_TEMPLATE_JA.format(error=str(e)),
                error=ErrorMessages.MAP_UPDATE_FAILED_ERROR_JA,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

        return map_obj
