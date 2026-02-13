# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class AllowExtraFieldsSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = {k: v for k, v in data.items() if k in self.fields}
        return super().to_internal_value(data)


class BoardingAlightingCheckerRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    data = serializers.ListField(child=serializers.DictField(), required=False)


class AvailableRouteKeywordsRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    data = serializers.ListField(child=serializers.DictField(), required=False)


class BoardingAlightingRoutesRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    route_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    route_group = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    route_groups = serializers.ListField(child=serializers.CharField(), required=False)
    date = serializers.CharField(required=False, allow_blank=True)
    trip_id = serializers.CharField(required=False, allow_blank=True)
    type = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.CharField(required=False, allow_blank=True)
    end_time = serializers.CharField(required=False, allow_blank=True)
    data = serializers.ListField(child=serializers.DictField(), required=False)


class BoardingAlightingClickDetailRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    route_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    route_group = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    route_groups = serializers.ListField(child=serializers.CharField(), required=False)
    date = serializers.CharField(required=False, allow_blank=True)
    trip_id = serializers.CharField(required=False, allow_blank=True)
    type = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.CharField(required=False, allow_blank=True)
    end_time = serializers.CharField(required=False, allow_blank=True)
    data = serializers.ListField(child=serializers.DictField(), required=False)
    selected = serializers.DictField(required=False)


class SegmentStopAnalyticsRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    mode = serializers.CharField(required=True)
    type = serializers.CharField(required=False, allow_blank=True)
    date = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.CharField(required=False, allow_blank=True)
    end_time = serializers.CharField(required=False, allow_blank=True)
    segment = serializers.DictField(required=False)
    stop = serializers.DictField(required=False)
    data = serializers.ListField(child=serializers.DictField(), required=False)


class SegmentStopAnalyticsFilterRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    mode = serializers.CharField(required=True)
    type = serializers.CharField(required=False, allow_blank=True)
    date = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.CharField(required=False, allow_blank=True)
    end_time = serializers.CharField(required=False, allow_blank=True)
    segment = serializers.DictField(required=False)
    stop = serializers.DictField(required=False)
    data = serializers.ListField(child=serializers.DictField(), required=False)


class SegmentCatalogRequestSerializer(AllowExtraFieldsSerializer):
    scenario_id = serializers.UUIDField(required=True)
    date = serializers.CharField(required=False, allow_blank=True)
    start_time = serializers.CharField(required=False, allow_blank=True)
    end_time = serializers.CharField(required=False, allow_blank=True)
    data = serializers.ListField(child=serializers.DictField(), required=False)
