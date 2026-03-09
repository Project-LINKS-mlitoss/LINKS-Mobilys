# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class NotificationCreateRequestSerializer(BaseRequestSerializer):
    """
    Request serializer for creating a notification.

    Kept permissive to avoid behavior changes (service layer remains source of truth).
    """

    message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notification_path = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    screen_menu = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_read = serializers.BooleanField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class NotificationDetailRequestSerializer(BaseRequestSerializer):
    """Request serializer for notification detail endpoint."""

    notification_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class NotificationUpdateRequestSerializer(BaseRequestSerializer):
    """Request serializer for notification update endpoint."""

    is_read = serializers.BooleanField(required=False, allow_null=True)

