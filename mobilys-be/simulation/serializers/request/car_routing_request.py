from rest_framework import serializers
from simulation.serializers.base import BaseRequestSerializer


class CarRoutingDetailRequestSerializer(BaseRequestSerializer):
    """Request DTO for car routing detail."""

    simulation_id = serializers.CharField(required=True)


class CarRoutingVolumeRequestSerializer(BaseRequestSerializer):
    """Request DTO for car volume detail."""

    simulation_id = serializers.CharField(required=True)
