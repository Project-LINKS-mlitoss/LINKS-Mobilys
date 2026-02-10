from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class CalendarServiceIdsRequestSerializer(BaseRequestSerializer):
    """Request serializer for Calendar service_ids endpoint."""

    scenario_id = serializers.CharField(required=True, help_text="Scenario ID (UUID)")
