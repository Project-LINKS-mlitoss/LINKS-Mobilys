from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class MapSerializer(BaseResponseSerializer):
    """Response serializer for Map rows."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    url = serializers.URLField()

