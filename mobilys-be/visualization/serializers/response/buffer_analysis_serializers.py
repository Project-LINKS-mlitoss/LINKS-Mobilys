# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class CoverageStatsSerializer(serializers.Serializer):
    algorithm = serializers.CharField()
    rounds_completed = serializers.IntegerField()
    max_walk_distance = serializers.IntegerField()
    walking_transfers_used = serializers.IntegerField()
    total_sequences = serializers.IntegerField()
    transfer_stops = serializers.IntegerField()
    explored_stops = serializers.IntegerField()
    processing_time_seconds = serializers.FloatField()


class PopulationItemSerializer(serializers.Serializer):
    cutoff_time = serializers.FloatField()
    age_0_14 = serializers.IntegerField()
    age_15_64 = serializers.IntegerField()
    age_65_up = serializers.IntegerField()
    total_population = serializers.IntegerField()


class BufferAnalysisNearestStopSerializer(serializers.Serializer):
    stop_uuid = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_id = serializers.CharField()
    stop_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_lat = serializers.FloatField(required=False, allow_null=True)
    stop_lon = serializers.FloatField(required=False, allow_null=True)
    distance = serializers.FloatField(required=False, allow_null=True)
    distance_m = serializers.FloatField(required=False, allow_null=True)
    stop_arrival_time = serializers.DateTimeField(required=False, allow_null=True)


class BufferAnalysisNearestStopsResponseSerializer(serializers.Serializer):
    data = BufferAnalysisNearestStopSerializer(many=True)
    total_stops = serializers.IntegerField()


class BufferAnalysisResponseSerializer(serializers.Serializer):
    buffer = serializers.JSONField()
    population = PopulationItemSerializer(many=True)
    coverage_stats = CoverageStatsSerializer()


class BufferAnalysisGraphResponseSerializer(serializers.Serializer):
    route_and_stops = serializers.JSONField()
    stops_on_buffer_area = serializers.JSONField()
    POI_on_buffer_area = serializers.JSONField()
    population = PopulationItemSerializer(many=True)
    coverage_stats = CoverageStatsSerializer()
