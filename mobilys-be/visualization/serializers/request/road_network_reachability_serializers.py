from rest_framework import serializers


class RoadNetworkReachabilityRequestSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField(required=True)
    origin_lon = serializers.FloatField(required=True)
    max_travel_time = serializers.IntegerField(required=False)
    walking_speed = serializers.FloatField(required=False)
    date = serializers.CharField(required=True)
    start_time = serializers.CharField(required=True)
    mode = serializers.CharField(required=False)
    max_walking_distance = serializers.IntegerField(required=False, allow_null=True)
    scenario_id = serializers.UUIDField(required=True)
    graph_type = serializers.CharField(required=True)


class RoadNetworkReachabilityAnalysisRequestSerializer(serializers.Serializer):
    isochrone = serializers.JSONField(required=False)
    isochrone_geojson = serializers.JSONField(required=False)
    scenario_id = serializers.UUIDField(required=True)
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class BuildOTPGraphQuerySerializer(serializers.Serializer):
    graph_type = serializers.CharField(required=False)


class PrefectureAvailabilityQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=False)
    graph_type = serializers.CharField(required=False)


