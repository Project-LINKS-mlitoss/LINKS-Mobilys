from rest_framework import serializers

from visualization.serializers.request.fields import CommaSeparatedListField


class BufferAnalysisNearestStopsQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    lat = serializers.FloatField(required=True)
    lon = serializers.FloatField(required=True)
    departure_date = serializers.DateField(required=False)
    departure_time = serializers.TimeField(required=False)
    walking_speed = serializers.FloatField(required=True)
    max_travel_time = serializers.FloatField(required=True)


class BufferAnalysisQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    lat = serializers.FloatField(required=True)
    lon = serializers.FloatField(required=True)
    departure_date = serializers.DateField(required=True)
    departure_time = serializers.TimeField(required=False)
    walking_speed = serializers.FloatField(required=True)
    max_travel_time = serializers.FloatField(required=True)
    max_transfers = serializers.IntegerField(required=False)
    max_walk_distance = serializers.IntegerField(required=False)


class BufferAnalysisGraphQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    lat = serializers.FloatField(required=True)
    lon = serializers.FloatField(required=True)
    departure_date = serializers.DateField(required=False)
    departure_time = serializers.TimeField(required=False)
    walking_speed = serializers.FloatField(required=False)
    max_travel_time = serializers.FloatField(required=False)
    max_transfers = serializers.IntegerField(required=False)
    max_walk_distance = serializers.IntegerField(required=False)
    project_id = serializers.UUIDField(required=False, allow_null=True)


class BufferAnalysisRoutesQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    is_using_shape_data = serializers.BooleanField(required=False)
    is_using_parent_stop = serializers.BooleanField(required=False)
    date = serializers.DateField(required=False)
    start_time = serializers.TimeField(required=False)
    end_time = serializers.TimeField(required=False)
    route_group_ids = CommaSeparatedListField(child=serializers.UUIDField(), required=False)
    # Accept raw strings (e.g., "undefined", "すべて") and let the service parse/ignore.
    direction_id = serializers.CharField(required=False, allow_blank=True)
    service_id = CommaSeparatedListField(child=serializers.CharField(), required=False)
