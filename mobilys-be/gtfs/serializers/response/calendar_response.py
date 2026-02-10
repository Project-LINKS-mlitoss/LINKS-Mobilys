from __future__ import annotations

from rest_framework import serializers

from gtfs.models import Calendar
from gtfs.serializers.base import BaseResponseSerializer


class CalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Calendar
        fields = "__all__"


class CalendarServiceIdsResponseSerializer(BaseResponseSerializer):
    """Response serializer for `CalendarService.list_service_ids` output."""

    service_ids = serializers.ListField(child=serializers.CharField())

