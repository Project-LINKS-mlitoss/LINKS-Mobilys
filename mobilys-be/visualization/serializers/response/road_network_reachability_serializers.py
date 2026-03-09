# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class RoadNetworkReachabilityResponseSerializer(serializers.Serializer):
    isochrone = serializers.JSONField()


class RoadNetworkReachabilityAnalysisResponseSerializer(serializers.Serializer):
    isochrone = serializers.JSONField()
    schools_within_isochrone = serializers.JSONField()
    medical_institutions_within_isochrone = serializers.JSONField()
    custom_poi = serializers.JSONField()
    population_within_isochrone = serializers.JSONField()
    stop_groups = serializers.JSONField()


class PrefectureAvailabilityResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    needed = serializers.JSONField()
    available = serializers.JSONField()
    missing = serializers.JSONField()
    graph_type = serializers.CharField()


