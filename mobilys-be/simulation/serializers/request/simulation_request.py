# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.serializers.base import BaseRequestSerializer


class SimulationWriteRequestSerializer(BaseRequestSerializer):
    """Request serializer for creating/updating a simulation."""

    name = serializers.CharField(max_length=200)
    original_scenario = serializers.UUIDField()
    duplicated_scenario = serializers.UUIDField()
