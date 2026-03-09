# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.models import OperatingEconomics
from simulation.serializers.base import BaseResponseSerializer


class OperatingEconomicsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperatingEconomics
        fields = [
            "id",
            "simulation",
            "route_id",
            "route_length_km",
            "cost_per_vkm_yen",
            "fare_override_yen",
            "delta_vehicle_km_per_day",
            "delta_cost_yen_per_day",
            "delta_revenue_yen_per_day",
            "net_per_day_yen",
            "annual_benefit_k_yen",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class OperatingEconomicsRouteEntrySerializer(BaseResponseSerializer):
    """DTO for a flattened operating economics route entry."""

    route_id = serializers.CharField()
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    operating_economics = OperatingEconomicsSerializer(required=False, allow_null=True)


class OperatingEconomicsPatternsPayloadResponseSerializer(BaseResponseSerializer):
    """DTO for operating economics patterns response payload."""

    simulation = serializers.CharField()
    simulation_input = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    routes = OperatingEconomicsRouteEntrySerializer(many=True)
