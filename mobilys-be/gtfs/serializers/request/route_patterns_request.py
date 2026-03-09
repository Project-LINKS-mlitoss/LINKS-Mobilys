# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class AnyField(serializers.Field):
    def to_internal_value(self, data):
        return data

    def to_representation(self, value):
        return value


class RoutePatternsCreateRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_data = AnyField(required=False)
    trip_data = AnyField(required=False)
    stop_sequence = AnyField(required=False)
    translations = AnyField(required=False, default=list)


class RoutePatternsRetrieveRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RoutePatternsDeleteRequestSerializer(BaseRequestSerializer):
    route_patterns = AnyField(required=False)


class RoutePatternsUpdateStopSequenceRequestSerializer(BaseRequestSerializer):
    route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = AnyField(required=False)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    new_stop_sequence = AnyField(required=False)


class RoutePatternsCreateExistingRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trip_data = AnyField(required=False)
    stop_sequence = AnyField(required=False)
