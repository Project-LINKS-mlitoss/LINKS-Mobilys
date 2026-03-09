# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from simulation.serializers.base import BaseRequestSerializer

from simulation.constants.choices import DAY_CHOICES


class RidershipChangeListRequestSerializer(BaseRequestSerializer):
    """Request DTO for ridership change list."""

    simulation = serializers.CharField(required=False)
    day_type = serializers.CharField(required=False)


class RidershipChangePatternsRequestSerializer(BaseRequestSerializer):
    """Request DTO for ridership change patterns."""

    simulation_id = serializers.CharField(required=True)
    day_type = serializers.CharField(required=False)
    service_ids = serializers.CharField(required=False)


class RCDefaultsQuerySerializer(BaseRequestSerializer):
    simulation = serializers.IntegerField(required=True)
    route_id = serializers.CharField(required=True, allow_blank=False)
    day_type = serializers.ChoiceField(choices=DAY_CHOICES, required=False, default="weekday")
    service_id = serializers.CharField(required=False, allow_blank=True)


class RCCalcInputSerializer(BaseRequestSerializer):
    simulation = serializers.IntegerField()
    route_id = serializers.CharField()
    day_type = serializers.ChoiceField(choices=DAY_CHOICES, default="weekday")

    baseline_riders_per_day = serializers.DecimalField(max_digits=12, decimal_places=2)
    baseline_trips_per_day = serializers.DecimalField(max_digits=9, decimal_places=2)
    delta_trips_per_day = serializers.DecimalField(max_digits=9, decimal_places=2)
    sensitivity_epsilon = serializers.DecimalField(max_digits=6, decimal_places=3)


class RCChangedRoutesQuerySerializer(BaseRequestSerializer):
    simulation = serializers.IntegerField(required=True)
    service_id = serializers.CharField(required=True, allow_blank=False)
