# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class NotificationListItemResponseSerializer(BaseResponseSerializer):
    id = serializers.UUIDField()
    message = serializers.CharField()
    notification_path = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    scenario_id = serializers.CharField(allow_null=True)
    screen_menu = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    is_read = serializers.BooleanField()
    description = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class NotificationDetailResponseSerializer(NotificationListItemResponseSerializer):
    error_response = serializers.JSONField(required=False, allow_null=True)


class NotificationCreateResponseSerializer(BaseResponseSerializer):
    id = serializers.CharField()


class NotificationUpdateResponseSerializer(BaseResponseSerializer):
    message = serializers.CharField()


class NotificationMarkAllReadResponseSerializer(BaseResponseSerializer):
    updated_count = serializers.IntegerField()

