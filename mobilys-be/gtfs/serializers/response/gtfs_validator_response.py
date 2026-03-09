# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class GtfsValidationSummaryResponseSerializer(BaseResponseSerializer):
    has_blocking_errors = serializers.BooleanField()
    blocking_error_count = serializers.IntegerField()
    safe_notice_count = serializers.IntegerField()
    fixable_notice_count = serializers.IntegerField()
    warning_count = serializers.IntegerField()
    info_count = serializers.IntegerField()
    skipped_count = serializers.IntegerField()


class _PreserveExtraKeysMixin:
    """
    Keep backward compatibility if service adds extra keys.

    Declared fields remain explicit for documentation, but we merge unknown keys
    back into the response.
    """

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance, dict):
            for k, v in instance.items():
                if k not in data:
                    data[k] = v
        return data


class GtfsValidationRunResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    message = serializers.CharField()
    validation_id = serializers.CharField()
    summary = GtfsValidationSummaryResponseSerializer()


class GtfsValidationResultResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    scenario_id = serializers.CharField()
    scenario_name = serializers.CharField()
    validated_at = serializers.DateTimeField()
    validator_version = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    summary = GtfsValidationSummaryResponseSerializer()

    blocking_errors = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    safe_notices = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    fixable_notices = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    warnings = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    infos = serializers.ListField(child=serializers.DictField(), required=False, default=list)

