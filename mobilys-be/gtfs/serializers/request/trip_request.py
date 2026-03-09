# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer
from gtfs.serializers.request.stop_request import StopTimesCreateUpdateSerializer


class TripUpsertRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.UUIDField(required=True)
    route_id = serializers.CharField(max_length=200)
    service_id = serializers.CharField(max_length=200)
    trip_headsign = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    trip_short_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    trip_id = serializers.CharField(max_length=200)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    stop_times = StopTimesCreateUpdateSerializer(many=True)

