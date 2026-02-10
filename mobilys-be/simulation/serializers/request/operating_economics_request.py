from rest_framework import serializers
from simulation.serializers.base import BaseRequestSerializer


class OperatingEconomicsPatternsRequestSerializer(BaseRequestSerializer):
    """Request DTO for operating economics patterns."""

    simulation_id = serializers.CharField(required=True)
    simulation_input = serializers.CharField(required=False)
    service_ids = serializers.CharField(required=False)
