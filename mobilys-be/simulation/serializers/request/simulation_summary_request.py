# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers

from simulation.serializers.base import BaseRequestSerializer


class SimulationSummaryRequestSerializer(BaseRequestSerializer):
    """Request DTO for simulation summary."""

    simulation_id = serializers.CharField(required=True)
