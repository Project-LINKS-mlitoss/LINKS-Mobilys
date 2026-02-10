from rest_framework import serializers

from simulation.serializers.base import BaseRequestSerializer


class SegmentSpeedMetricsListRequestSerializer(BaseRequestSerializer):
    """Request DTO for segment speed metrics list."""

    simulation = serializers.CharField(required=True)
    service_id = serializers.CharField(required=False, allow_blank=True)
    car_change_number = serializers.CharField(required=False, allow_blank=True)
