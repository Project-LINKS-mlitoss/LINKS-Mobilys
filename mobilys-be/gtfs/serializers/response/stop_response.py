# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class StopSerializer(BaseResponseSerializer):
    id = serializers.IntegerField()
    stop_id = serializers.CharField()
    stop_code = serializers.CharField(required=False, allow_blank=True)
    stop_name = serializers.CharField()
    stop_desc = serializers.CharField(required=False, allow_blank=True)
    stop_lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    stop_lon = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    zone_id = serializers.CharField(required=False, allow_blank=True)
    stop_url = serializers.URLField(required=False, allow_blank=True)
    location_type = serializers.IntegerField(required=False, allow_null=True)
    parent_station = serializers.CharField(required=False, allow_blank=True)
    wheelchair_boarding = serializers.IntegerField(required=False, allow_null=True)
    platform_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    tts_stop_name = serializers.CharField(required=False, allow_blank=True)
    stop_timezone = serializers.CharField(required=False, allow_blank=True)
    level_id = serializers.CharField(required=False, allow_blank=True)
    stop_access = serializers.IntegerField(required=False, allow_null=True)
    scenario = serializers.UUIDField(source="scenario_id")
    created_datetime = serializers.DateTimeField()
    updated_datetime = serializers.DateTimeField()


class StopTimesSerializer(BaseResponseSerializer):
    id = serializers.IntegerField()
    trip_id = serializers.CharField()
    stop_sequence = serializers.IntegerField()
    arrival_time = serializers.TimeField(required=False, allow_null=True)
    departure_time = serializers.TimeField(required=False, allow_null=True)
    stop_id = serializers.CharField()
    stop_name = serializers.SerializerMethodField(read_only=True)
    stop_headsign = serializers.CharField(required=False, allow_blank=True)
    pickup_type = serializers.IntegerField(required=False, allow_null=True)
    drop_off_type = serializers.IntegerField(required=False, allow_null=True)
    shape_dist_traveled = serializers.FloatField(required=False, allow_null=True)
    timepoint = serializers.IntegerField(required=False, allow_null=True)
    is_arrival_time_next_day = serializers.BooleanField()
    is_departure_time_next_day = serializers.BooleanField()

    def get_stop_name(self, obj):
        stop_name_by_stop_id = self.context.get("stop_name_by_stop_id") or {}
        return stop_name_by_stop_id.get(obj.stop_id)

