# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class RouteGroupSerializer(serializers.Serializer):
    route_group_id = serializers.CharField()
    route_group_name = serializers.CharField()
    color = serializers.CharField()


class StopSerializer(serializers.Serializer):
    stop_id = serializers.CharField()
    stop_name = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    stop_lat = serializers.FloatField(allow_null=True, required=False)
    stop_lon = serializers.FloatField(allow_null=True, required=False)


class ChildFrequencySerializer(serializers.Serializer):
    name = serializers.CharField()
    frequency = serializers.IntegerField()


class RouteGroupGraphItemSerializer(serializers.Serializer):
    group_name = serializers.CharField()
    childs = ChildFrequencySerializer(many=True)


class StopGroupGraphItemSerializer(serializers.Serializer):
    parent = serializers.CharField()
    childs = ChildFrequencySerializer(many=True)


class StopGroupGraphSerializer(serializers.Serializer):
    grouping_method = serializers.CharField()
    group_data = StopGroupGraphItemSerializer(many=True)


class RouteGroupTotalGraphGroupSerializer(serializers.Serializer):
    name = serializers.CharField()
    value = serializers.IntegerField()
    color = serializers.CharField()


class RouteGroupTotalGraphItemSerializer(serializers.Serializer):
    hour = serializers.CharField()
    groups = RouteGroupTotalGraphGroupSerializer(many=True)


class EdgeSerializer(serializers.Serializer):
    source = serializers.CharField()
    target = serializers.CharField()
    trip_count = serializers.IntegerField()
    colors = serializers.ListField(child=serializers.CharField())
    route_group_ids = serializers.ListField(child=serializers.UUIDField())
    route_groups = serializers.ListField(child=serializers.CharField())
    geojson_data = serializers.ListField(child=serializers.ListField(child=serializers.FloatField()))


class TotalBusOnStopsResponseSerializer(serializers.Serializer):
    routes_group = RouteGroupSerializer(many=True)
    stops = StopSerializer(many=True)
    route_group_graph = RouteGroupGraphItemSerializer(many=True)
    stop_group_graph = StopGroupGraphSerializer()
    route_group_total_graph = RouteGroupTotalGraphItemSerializer(many=True)
    edges = EdgeSerializer(many=True)


class TripDetailSerializer(serializers.Serializer):
    trip_id = serializers.CharField()
    departure_time = serializers.CharField()
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RoutePatternSerializer(serializers.Serializer):
    pattern_id = serializers.CharField()
    route_id = serializers.CharField()
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    service_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    segment = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    first_stop_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_stop_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_direction_id_generated = serializers.BooleanField(required=False)
    trips = TripDetailSerializer(many=True)
    trip_count = serializers.IntegerField()


class RouteDetailSerializer(serializers.Serializer):
    route_id = serializers.CharField()
    route_short_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_long_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_type = serializers.IntegerField(required=False, allow_null=True)
    agency_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    route_patterns = RoutePatternSerializer(many=True)


class RouteGroupDetailSerializer(serializers.Serializer):
    route_group_id = serializers.CharField()
    route_group_name = serializers.CharField()
    routes = RouteDetailSerializer(many=True)


class StopDetailSerializer(serializers.Serializer):
    stop_id = serializers.CharField()
    stop_name = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    stop_lat = serializers.FloatField(allow_null=True, required=False)
    stop_lon = serializers.FloatField(allow_null=True, required=False)
    route_groups = RouteGroupDetailSerializer(many=True)


class TotalBusOnStopGroupDetailResponseSerializer(serializers.Serializer):
    stop_group_name = serializers.CharField()
    stops = StopDetailSerializer(many=True)

