# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.serializers.base import BaseRequestSerializer


class CO2ListRequestSerializer(BaseRequestSerializer):
    """Request DTO for CO2 list."""

    simulation = serializers.CharField(required=True)
    simulation_input = serializers.CharField(required=False)


class CO2PatternsRequestSerializer(BaseRequestSerializer):
    """Request DTO for CO2 patterns."""

    simulation_id = serializers.CharField(required=True)
    simulation_input = serializers.CharField(required=False)
    service_ids = serializers.CharField(required=False)


class CO2TotalsRequestSerializer(BaseRequestSerializer):
    """Request DTO for CO2 totals."""

    simulation = serializers.CharField(required=True)
    simulation_input = serializers.CharField(required=False)
