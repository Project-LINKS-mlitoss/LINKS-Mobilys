# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers

from simulation.serializers.base import BaseResponseSerializer


class SegmentSpeedMetricsValuePairSerializer(BaseResponseSerializer):
    """DTO for before/after values."""

    before = serializers.FloatField(required=False, allow_null=True)
    after = serializers.FloatField(required=False, allow_null=True)


class SegmentSpeedMetricsMetricsSerializer(BaseResponseSerializer):
    """DTO for segment speed metrics."""

    speed_kmh = SegmentSpeedMetricsValuePairSerializer()
    time_per_vehicle_h = SegmentSpeedMetricsValuePairSerializer()
    total_time_vehicle_h = SegmentSpeedMetricsValuePairSerializer()


class SegmentSpeedMetricsSegmentSerializer(BaseResponseSerializer):
    """DTO for a segment entry."""

    matchcode_shp = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    section_code_csv = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    road_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    metrics = SegmentSpeedMetricsMetricsSerializer()


class SegmentSpeedMetricsShapeSerializer(BaseResponseSerializer):
    """DTO for a route shape entry."""

    route_pattern = serializers.JSONField(required=False)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    segments = SegmentSpeedMetricsSegmentSerializer(many=True)


class SegmentSpeedMetricsRouteSerializer(BaseResponseSerializer):
    """DTO for route-level segment speed metrics."""

    route_id = serializers.CharField(allow_blank=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shapes = SegmentSpeedMetricsShapeSerializer(many=True)


class SegmentSpeedMetricsPayloadResponseSerializer(BaseResponseSerializer):
    """DTO for segment speed metrics list response payload."""

    simulation = serializers.CharField()
    car_change_number = serializers.FloatField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    routes = SegmentSpeedMetricsRouteSerializer(many=True)
