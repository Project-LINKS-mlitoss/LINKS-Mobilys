from rest_framework import serializers

from simulation.serializers.base import BaseRequestSerializer


class SimulationSummaryRequestSerializer(BaseRequestSerializer):
    """Request DTO for simulation summary."""

    simulation_id = serializers.CharField(required=True)
