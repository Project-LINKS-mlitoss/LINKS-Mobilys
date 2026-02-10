from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class ShapePointResponseSerializer(BaseResponseSerializer):
    shape_pt_lat = serializers.FloatField()
    shape_pt_lon = serializers.FloatField()
    shape_pt_sequence = serializers.IntegerField()
    shape_dist_traveled = serializers.FloatField(required=False, allow_null=True)


class ShapeGenerateShapesResponseSerializer(BaseResponseSerializer):
    data = serializers.JSONField(required=False, allow_null=True)
    message = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    error = serializers.JSONField(required=False, allow_null=True)


class ShapeBulkUpdateResultDataResponseSerializer(BaseResponseSerializer):
    updated = serializers.IntegerField()
    created = serializers.IntegerField()


class ShapeTripPatternStatResponseSerializer(BaseResponseSerializer):
    route_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    service_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    trip_headsign = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    pattern_hash = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    matched_trips = serializers.IntegerField()


class ShapeCreateFromTripPatternsResultDataResponseSerializer(BaseResponseSerializer):
    scenario_id = serializers.CharField()
    shape_id = serializers.CharField()
    shape_points_created = serializers.IntegerField()
    trips_updated = serializers.IntegerField()
    patterns = ShapeTripPatternStatResponseSerializer(many=True)
