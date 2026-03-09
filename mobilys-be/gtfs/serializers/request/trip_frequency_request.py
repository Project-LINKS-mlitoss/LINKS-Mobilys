# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class TripFrequencyRetrieveRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(help_text="Scenario ID (UUID).")


class TripFrequencyCreateTripPatternRequestSerializer(BaseRequestSerializer):
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    current_interval = serializers.IntegerField(required=False, allow_null=True)
    new_interval = serializers.IntegerField(required=False, allow_null=True)


class TripFrequencyCreateRouteRequestSerializer(BaseRequestSerializer):
    route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trips = TripFrequencyCreateTripPatternRequestSerializer(many=True, required=False)


class TripFrequencyCreateGroupRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    routes = TripFrequencyCreateRouteRequestSerializer(many=True, required=False)


class TripFrequencyCreateRequestSerializer(BaseRequestSerializer):
    items = TripFrequencyCreateGroupRequestSerializer(many=True, allow_empty=False)


class TripDetailListRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField()
    route_id = serializers.CharField()
    service_id = serializers.CharField()
    direction_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trip_headsign = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class TripDetailCoordinatesRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField()

