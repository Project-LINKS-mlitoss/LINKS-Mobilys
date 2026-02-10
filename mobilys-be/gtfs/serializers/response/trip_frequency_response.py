from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class TripFrequencyRetrieveTripPatternResponseSerializer(BaseResponseSerializer):
    trip_id = serializers.CharField()
    route_id = serializers.CharField()
    service_id = serializers.CharField()
    is_direction_id_generated = serializers.BooleanField()
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    first_and_last_stop_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    trip_headsign = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    interval = serializers.IntegerField(required=False, allow_null=True)
    pattern_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class TripFrequencyRetrieveRouteResponseSerializer(BaseResponseSerializer):
    id = serializers.IntegerField()
    route_id = serializers.CharField()
    agency_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_short_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_long_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_desc = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_type = serializers.IntegerField(required=False, allow_null=True)
    route_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_color = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_text_color = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_sort_order = serializers.IntegerField(required=False, allow_null=True)
    continuous_pickup = serializers.IntegerField(required=False, allow_null=True)
    continuous_drop_off = serializers.IntegerField(required=False, allow_null=True)
    network_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    cemv_support = serializers.BooleanField(required=False, allow_null=True)
    jp_parent_route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scenario = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    created_datetime = serializers.DateTimeField(required=False, allow_null=True)
    updated_datetime = serializers.DateTimeField(required=False, allow_null=True)

    trips_pattern = TripFrequencyRetrieveTripPatternResponseSerializer(many=True, required=False)


class TripFrequencyRetrieveGroupResponseSerializer(BaseResponseSerializer):
    group_route_id = serializers.CharField()
    group_route_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    routes = TripFrequencyRetrieveRouteResponseSerializer(many=True)


class TripFrequencyGeneratedTripResponseSerializer(BaseResponseSerializer):
    trip_id = serializers.CharField()
    adjustment = serializers.DictField(required=False)


class TripFrequencyWarningResponseSerializer(BaseResponseSerializer):
    route_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    reason = serializers.CharField()


class TripFrequencyCreateResponseDataSerializer(BaseResponseSerializer):
    generated_trips = TripFrequencyGeneratedTripResponseSerializer(many=True)
    warnings = TripFrequencyWarningResponseSerializer(many=True, required=False)


class TripDetailListItemResponseSerializer(BaseResponseSerializer):
    departure_time = serializers.TimeField(required=False, allow_null=True)
    is_departure_time_next_day = serializers.BooleanField()
    trip_id = serializers.CharField()
    route_id = serializers.CharField()
    service_id = serializers.CharField()
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    trip_headsign = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class TripDetailCoordinatesPointResponseSerializer(BaseResponseSerializer):
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    sequence = serializers.IntegerField()


class TripDetailCoordinatesResponseSerializer(BaseResponseSerializer):
    shape_id = serializers.CharField()
    coordinates = TripDetailCoordinatesPointResponseSerializer(many=True)
    stops_geojson = serializers.JSONField()

