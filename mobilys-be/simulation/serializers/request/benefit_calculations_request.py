# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.serializers.base import BaseRequestSerializer


class BenefitCalculationsListRequestSerializer(BaseRequestSerializer):
    """Request DTO for benefit calculations list."""

    simulation = serializers.CharField(required=True)
