# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.models import CO2Reduction
from simulation.serializers.base import BaseResponseSerializer


class CO2ReductionByRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CO2Reduction
        fields = [
            "id",
            "simulation",
            "simulation_input",
            "route_id",
            "vkt_before_km_day",
            "vkt_after_km_day",
            "delta_vkt_km_day",
            "ef_car_g_per_vkm",
            "co2_tons_per_year",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class CO2RouteEntrySerializer(BaseResponseSerializer):
    """DTO for a flattened CO2 route entry."""

    route_id = serializers.CharField()
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    co2_reduction = CO2ReductionByRouteSerializer(required=False, allow_null=True)


class CO2PatternsPayloadResponseSerializer(BaseResponseSerializer):
    """DTO for CO2 patterns response payload."""

    simulation = serializers.CharField()
    simulation_input = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    routes = CO2RouteEntrySerializer(many=True)


class CO2TotalsResponseSerializer(BaseResponseSerializer):
    """DTO for CO2 totals response payload."""

    simulation = serializers.IntegerField()
    vkt_before_km_day = serializers.FloatField()
    vkt_after_km_day = serializers.FloatField()
    delta_vkt_km_day = serializers.FloatField()
    ef_car_g_per_vkm = serializers.FloatField()
    co2_tons_per_year = serializers.FloatField()
