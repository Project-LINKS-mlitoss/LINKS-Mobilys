# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from typing import Any

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class SafeNoticeRuleListRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing safe notice rules."""

    severity = serializers.CharField(required=False, allow_blank=True, help_text="Optional: ERROR, WARNING, INFO")
    is_active = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional: true/false (also accepts 1/0/yes/no)",
    )

    def validate_is_active(self, value):
        if value in (None, ""):
            return None
        raw = str(value).strip().lower()
        if raw in ("true", "1", "yes"):
            return True
        if raw in ("false", "0", "no"):
            return False
        raise serializers.ValidationError("Invalid is_active value. Use true/false.")


class SafeNoticeRuleUpsertSerializer(BaseRequestSerializer):
    severity = serializers.ChoiceField(choices=["ERROR", "WARNING", "INFO"])
    code = serializers.CharField(max_length=200)

    reason_ja = serializers.CharField()
    reason_en = serializers.CharField()

    sample_conditions = serializers.JSONField(required=False, allow_null=True, default=None)
    allowed_filenames = serializers.ListField(child=serializers.CharField(max_length=255), required=False, default=list)
    skip = serializers.BooleanField(default=False)
    is_active = serializers.BooleanField(default=True)
    is_fixable = serializers.BooleanField(default=False)


class BulkUpsertSafeNoticeRulesSerializer(BaseRequestSerializer):
    rules = serializers.ListField(child=SafeNoticeRuleUpsertSerializer(), allow_empty=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        rules = attrs["rules"]
        codes = [r["code"] for r in rules]
        if len(codes) != len(set(codes)):
            raise serializers.ValidationError("Duplicate code in request.rules")
        return attrs

