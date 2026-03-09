# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.models import SimulationValidationResult
from gtfs.models import Scenario


class SimulationSerializer(serializers.Serializer):
    name = serializers.CharField(required=True, allow_blank=False)
    original_scenario = serializers.PrimaryKeyRelatedField(queryset=Scenario.objects.all())
    duplicated_scenario = serializers.PrimaryKeyRelatedField(queryset=Scenario.objects.all())


class SimulationValidationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = SimulationValidationResult
        fields = [
            "simulation", "simulation_input",
            "version", "is_latest",
            "file_name", "file_size", "file_sha256",
            "service_date", "service_id", "service_ids",
            "result_json", "summary_counts",
            "status", "created_at", "updated_at",
        ]
