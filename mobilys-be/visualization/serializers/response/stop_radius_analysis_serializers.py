# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class StopGroupBufferAnalysisResponseSerializer(serializers.Serializer):
    radius = serializers.JSONField()


class StopGroupBufferAnalysisGraphResponseSerializer(serializers.Serializer):
    stop_group_method = serializers.CharField()
    radius_m = serializers.FloatField()
    population_total = serializers.JSONField()
    poi_summary = serializers.JSONField()
    poi_for_map = serializers.JSONField()
