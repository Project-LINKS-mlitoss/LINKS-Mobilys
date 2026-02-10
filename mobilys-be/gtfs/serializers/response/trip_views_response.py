from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer
from gtfs.serializers.response.trip_response import TripModelSerializer


class TripRoutePatternTripItemResponseSerializer(BaseResponseSerializer):
    trip_id = serializers.CharField()
    service_id = serializers.CharField()
    trip_headsign = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trip_short_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    departure_time = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_direction_id_generated = serializers.BooleanField(required=False)


class TripRoutePatternResponseSerializer(BaseResponseSerializer):
    pattern_id = serializers.CharField()
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField()
    headways = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trips = TripRoutePatternTripItemResponseSerializer(many=True)


class TripRoutePatternsRouteResponseSerializer(BaseResponseSerializer):
    route_id = serializers.CharField()
    route_short_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_long_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_type = serializers.IntegerField(required=False, allow_null=True)
    agency_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_patterns = TripRoutePatternResponseSerializer(many=True)


class PreviewShapeCoordinatesLonLatPairResponseSerializer(BaseResponseSerializer):
    def to_representation(self, instance):
        return instance


class TripEditStopTimeResponseSerializer(BaseResponseSerializer):
    id = serializers.IntegerField()
    trip_id = serializers.CharField()
    stop_sequence = serializers.IntegerField()
    arrival_time = serializers.TimeField(required=False, allow_null=True)
    departure_time = serializers.TimeField(required=False, allow_null=True)
    stop_id = serializers.CharField()
    stop_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_headsign = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pickup_type = serializers.IntegerField(required=False, allow_null=True)
    drop_off_type = serializers.IntegerField(required=False, allow_null=True)
    shape_dist_traveled = serializers.FloatField(required=False, allow_null=True)
    timepoint = serializers.IntegerField(required=False, allow_null=True)
    is_arrival_time_next_day = serializers.BooleanField(required=False)
    is_departure_time_next_day = serializers.BooleanField(required=False)


class TripEditResponseDataSerializer(BaseResponseSerializer):
    trip = TripModelSerializer()
    stop_times = TripEditStopTimeResponseSerializer(many=True)


class TripBulkDeleteResponseDataSerializer(BaseResponseSerializer):
    deleted_trip_ids = serializers.ListField(child=serializers.CharField())
    not_found_trip_ids = serializers.ListField(child=serializers.CharField(), required=False)

