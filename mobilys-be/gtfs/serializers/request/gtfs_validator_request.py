from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class GtfsValidateRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.UUIDField()


class GtfsValidationResultRequestSerializer(BaseRequestSerializer):
    """Request serializer for `GtfsValidationView.get` query params."""

    scenario_id = serializers.CharField(required=True, allow_blank=False, help_text="Scenario ID (UUID)")
    severity = serializers.CharField(required=False, allow_blank=True, help_text="Optional: ERROR, WARNING, INFO")
    code = serializers.CharField(required=False, allow_blank=True, help_text="Optional: notice code")
    is_safe = serializers.CharField(required=False, allow_blank=True, help_text="Optional: true/false")
    lang = serializers.CharField(required=False, allow_blank=True, default="ja", help_text="Optional: ja/en")

