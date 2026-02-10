from rest_framework import serializers
from simulation.models import RidershipChange
from simulation.serializers.base import BaseResponseSerializer


class RidershipChangeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = RidershipChange
        fields = [
            "id",
            "route_id",
            "day_type",
            "baseline_riders_per_day",
            "baseline_trips_per_day",
            "delta_trips_per_day",
            "sensitivity_epsilon",
            "delta_riders_per_day",
            "gtfs_service_id",
            "status",
        ]


class RidershipChangeDefaultsResponseSerializer(BaseResponseSerializer):
    """DTO for ridership change defaults response payload."""

    simulation = serializers.IntegerField()
    route_id = serializers.CharField()
    day_type = serializers.CharField()
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    baseline_trips_per_day = serializers.FloatField()
    trips_scenario2_per_day = serializers.FloatField(required=False, allow_null=True)
    delta_trips_per_day = serializers.FloatField()
    baseline_riders_per_day = serializers.FloatField()
    sensitivity_epsilon = serializers.FloatField()
    status = serializers.CharField()


class RidershipChangeCalcResponseSerializer(BaseResponseSerializer):
    """DTO for ridership change calculation response payload."""

    simulation = serializers.IntegerField()
    route_id = serializers.CharField()
    day_type = serializers.CharField()
    baseline_trips_per_day = serializers.FloatField()
    baseline_riders_per_day = serializers.FloatField()
    delta_trips_per_day = serializers.FloatField()
    sensitivity_epsilon = serializers.FloatField()
    delta_riders_per_day = serializers.IntegerField()
    status = serializers.CharField()


class RidershipChangeChangedRouteSerializer(BaseResponseSerializer):
    """DTO for changed route entry."""

    route_id = serializers.CharField()
    baseline_trips_per_day = serializers.FloatField()
    trips_scenario2_per_day = serializers.FloatField()
    delta_trips_per_day = serializers.FloatField()


class RidershipChangeRouteEntrySerializer(BaseResponseSerializer):
    """DTO for a flattened route entry in the patterns response."""

    route_id = serializers.CharField()
    pattern_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    segment = serializers.CharField(required=False, allow_blank=True)
    ridership_change = RidershipChangeListSerializer(required=False, allow_null=True)
    route_pattern = serializers.JSONField(required=False)


class RidershipChangePatternsPayloadResponseSerializer(BaseResponseSerializer):
    """DTO for ridership change patterns response payload."""

    simulation = serializers.CharField()
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    routes = RidershipChangeRouteEntrySerializer(many=True)
