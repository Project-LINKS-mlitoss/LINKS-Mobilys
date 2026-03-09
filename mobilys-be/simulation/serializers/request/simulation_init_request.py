# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers

from simulation.serializers.base import BaseRequestSerializer


class SimulationInitGetRequestSerializer(BaseRequestSerializer):
    """Request DTO for fetching the latest simulation init input."""

    simulation_id = serializers.CharField()


class SimulationInitCreateRequestSerializer(BaseRequestSerializer):
    """Request DTO for creating simulation init input (supports snake/camel keys)."""

    simulation_id = serializers.CharField()

    service_date = serializers.CharField(required=False)
    serviceDate = serializers.CharField(required=False)

    service_id = serializers.CharField(required=False)
    serviceId = serializers.CharField(required=False)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    serviceIds = serializers.ListField(child=serializers.CharField(), required=False)

    epsilon_inc = serializers.CharField(required=False)
    sensitivity_up = serializers.CharField(required=False)
    epsilon_dec = serializers.CharField(required=False)
    sensitivity_down = serializers.CharField(required=False)

    cost_per_share = serializers.CharField(required=False)
    costPerVehKmYen = serializers.CharField(required=False)

    car_share = serializers.CharField(required=False)
    carShare = serializers.CharField(required=False)

    time_value_yen_per_min_per_vehicle = serializers.CharField(required=False)
    timeValueYenPerMin_perVehicle = serializers.CharField(required=False)

    default_fare = serializers.CharField(required=False)
    defaultFare = serializers.CharField(required=False)

    same_with_bus = serializers.BooleanField(required=False)
    sameWithBus = serializers.BooleanField(required=False)
    prefer_bus = serializers.BooleanField(required=False)
    preferBus = serializers.BooleanField(required=False)

    buffer_bus = serializers.IntegerField(required=False)
    bufferBus = serializers.IntegerField(required=False)
    bus_buffer_m = serializers.IntegerField(required=False)
    busBufferM = serializers.IntegerField(required=False)

    csv_penalty_factor = serializers.FloatField(required=False)
    csvPenaltyFactor = serializers.FloatField(required=False)

    file = serializers.FileField(required=False, allow_null=True)


class SimulationInitDiffRequestSerializer(BaseRequestSerializer):
    """Request DTO for CSV diff against simulation scenarios."""

    simulation_id = serializers.CharField()
    file = serializers.FileField()


class SimulationUnionServiceIdsRequestSerializer(BaseRequestSerializer):
    """Request DTO for union service ids by date."""

    simulation_id = serializers.CharField()
    date = serializers.CharField()


class ValidateAndSaveCSVRequestSerializer(BaseRequestSerializer):
    """Request DTO for validating and saving a CSV file."""

    simulation_input_id = serializers.CharField(required=False)
    file = serializers.FileField()
