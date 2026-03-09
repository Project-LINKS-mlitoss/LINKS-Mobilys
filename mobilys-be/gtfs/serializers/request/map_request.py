# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class SetUserMapRequestSerializer(BaseRequestSerializer):
    """Request serializer for setting user's active map."""

    map_id = serializers.CharField(required=True, allow_blank=False, help_text="Map ID")

