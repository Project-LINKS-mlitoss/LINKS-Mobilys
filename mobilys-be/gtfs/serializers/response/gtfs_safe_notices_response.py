from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class SafeNoticeRuleListSerializer(BaseResponseSerializer):
    """Response serializer for safe notice rules list."""

    id = serializers.IntegerField()
    severity = serializers.CharField()
    code = serializers.CharField()
    reason_ja = serializers.CharField()
    reason_en = serializers.CharField()
    sample_conditions = serializers.JSONField(allow_null=True)
    allowed_filenames = serializers.ListField(child=serializers.CharField())
    skip = serializers.BooleanField()
    is_active = serializers.BooleanField()
    is_fixable = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class BulkUpsertSafeNoticeRulesResponseSerializer(BaseResponseSerializer):
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
    total = serializers.IntegerField()

