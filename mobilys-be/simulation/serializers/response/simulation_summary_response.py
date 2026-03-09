# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers

from simulation.serializers.base import BaseResponseSerializer
from simulation.serializers.response.benefit_calculations_response import (
    BenefitCalculationsPayloadResponseSerializer,
)
from simulation.serializers.response.car_routing_response import (
    CarRoutingVolumeResponseSerializer,
)


class SimulationSummaryCarVolumeResponseSerializer(BaseResponseSerializer):
    """DTO for car volume section in simulation summary."""

    data = CarRoutingVolumeResponseSerializer()
    message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    error = serializers.JSONField(required=False, allow_null=True)


class SimulationSummaryBenefitResponseSerializer(BaseResponseSerializer):
    """DTO for benefit calculations section in simulation summary."""

    data = BenefitCalculationsPayloadResponseSerializer()
    message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    error = serializers.JSONField(required=False, allow_null=True)


class SimulationSummaryResponseSerializer(BaseResponseSerializer):
    """DTO for simulation summary response payload."""

    ridership_change_data = serializers.JSONField()
    operating_economics_data = serializers.JSONField()
    car_volume_data = SimulationSummaryCarVolumeResponseSerializer()
    segment_speed_metrics_data = serializers.JSONField()
    benefit_calculations = SimulationSummaryBenefitResponseSerializer()
    co2_reduction = serializers.JSONField()
