# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.response.stop_response import StopTimesSerializer
from gtfs.serializers.base import BaseResponseSerializer


class AdjustmentSerializer(BaseResponseSerializer):
    operator = serializers.CharField()
    value = serializers.FloatField()


class TripSerializer(BaseResponseSerializer):
    trip_id = serializers.CharField()
    adjustment = AdjustmentSerializer(required=False)


class TripModelSerializer(BaseResponseSerializer):
    id = serializers.IntegerField()
    scenario_id = serializers.UUIDField()
    route_id = serializers.CharField()
    service_id = serializers.CharField()
    trip_headsign = serializers.CharField(required=False, allow_blank=True)
    trip_short_name = serializers.CharField(required=False, allow_blank=True)
    trip_id = serializers.CharField()
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    stop_times_detail = serializers.SerializerMethodField(read_only=True)

    def get_stop_times_detail(self, obj):
        if isinstance(obj, dict):
            return obj.get("stop_times_detail") or []
        stop_times = getattr(obj, "_prefetched_stop_times", None)
        if stop_times is None:
            return []
        return StopTimesSerializer(stop_times, many=True, context=self.context).data

