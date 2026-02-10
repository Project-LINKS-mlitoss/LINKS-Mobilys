from rest_framework import serializers
from simulation.models import Simulation, SimulationValidationResult


class SimulationResponseSerializer(serializers.ModelSerializer):
    """Response serializer for simulation details."""

    original_scenario = serializers.UUIDField(source="original_scenario_id", read_only=True)
    duplicated_scenario = serializers.UUIDField(source="duplicated_scenario_id", read_only=True)

    original_scenario_id = serializers.UUIDField(
        source="original_scenario.id", read_only=True
    )
    original_scenario_name = serializers.CharField(
        source="original_scenario.scenario_name", read_only=True
    )

    duplicated_scenario_id = serializers.UUIDField(
        source="duplicated_scenario.id", read_only=True
    )
    duplicated_scenario_name = serializers.CharField(
        source="duplicated_scenario.scenario_name", read_only=True
    )

    user = serializers.IntegerField(source="user_id", read_only=True)

    scenario_source = serializers.CharField(read_only=True, allow_null=True)
    project_name = serializers.CharField(read_only=True, allow_null=True)
    has_run = serializers.BooleanField(read_only=True)

    class Meta:
        model = Simulation
        fields = [
            "id",
            "name",
            "created_at",
            "original_scenario",
            "duplicated_scenario",
            "original_scenario_id",
            "original_scenario_name",
            "duplicated_scenario_id",
            "duplicated_scenario_name",
            "user",
            "scenario_source",
            "project_name",
            "has_run",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "original_scenario",
            "duplicated_scenario",
            "original_scenario_id",
            "original_scenario_name",
            "duplicated_scenario_id",
            "duplicated_scenario_name",
            "user",
            "scenario_source",
            "project_name",
            "has_run",
        ]


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
