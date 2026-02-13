# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers

from visualization.serializers.request.fields import CommaSeparatedListField


class TotalBusOnStopsQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    date = serializers.DateField(required=False)
    start_time = serializers.TimeField(required=False)
    end_time = serializers.TimeField(required=False)
    route_group_ids = CommaSeparatedListField(child=serializers.UUIDField(), required=False)
    direction_id = serializers.IntegerField(required=False)
    service_id = CommaSeparatedListField(child=serializers.CharField(), required=False)


class TotalBusOnStopGroupDetailQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    stop_id = serializers.IntegerField(required=True)
    date = serializers.DateField(required=False)
    start_time = serializers.TimeField(required=False)
    end_time = serializers.TimeField(required=False)
    service_id = CommaSeparatedListField(child=serializers.CharField(), required=False)
    direction_id = serializers.IntegerField(required=False)
    route_group_ids = CommaSeparatedListField(child=serializers.UUIDField(), required=False)


class TotalBusOnStopDetailQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    stop_id = serializers.CharField(required=True)
    date = serializers.DateField(required=False)
    start_time = serializers.TimeField(required=False)
    end_time = serializers.TimeField(required=False)
    service_id = CommaSeparatedListField(child=serializers.CharField(), required=False)
    direction_id = serializers.IntegerField(required=False)
    route_group_ids = CommaSeparatedListField(child=serializers.UUIDField(), required=False)

