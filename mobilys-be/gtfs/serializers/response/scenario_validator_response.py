# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class _PreserveExtraKeysMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance, dict):
            for k, v in instance.items():
                if k not in data:
                    data[k] = v
        return data


class ScenarioValidationLocalDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    scenario_name = serializers.CharField()
    filename = serializers.CharField()
    validation_status = serializers.CharField()


class ScenarioValidationApiDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    scenario_name = serializers.CharField()
    organization_id = serializers.CharField()
    feed_id = serializers.CharField()
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    validation_status = serializers.CharField()

