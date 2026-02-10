from rest_framework import serializers


class RouteAvailabilitySerializer(serializers.Serializer):
    route_id = serializers.CharField()
    is_available = serializers.BooleanField()


class TripAvailabilitySerializer(serializers.Serializer):
    trip_id = serializers.CharField()
    is_available = serializers.BooleanField()


class StopAvailabilitySerializer(serializers.Serializer):
    stop_id = serializers.CharField()
    is_available = serializers.BooleanField()


class BoardingAlightingCheckerDataSerializer(serializers.Serializer):
    routes = RouteAvailabilitySerializer(many=True)
    trips = TripAvailabilitySerializer(many=True)
    stops = StopAvailabilitySerializer(many=True)
    available_route_keywords = serializers.ListField(child=serializers.CharField())


class BoardingAlightingCheckerResponseSerializer(serializers.Serializer):
    data = BoardingAlightingCheckerDataSerializer()


class AvailableRouteKeywordRouteSerializer(serializers.Serializer):
    route_id = serializers.CharField()
    route_name = serializers.CharField()
    valid_trip_ids = serializers.ListField(child=serializers.CharField())


class KeywordRoutesSerializer(serializers.Serializer):
    keyword = serializers.CharField()
    route_ids = serializers.ListField(child=serializers.CharField())
    routes = AvailableRouteKeywordRouteSerializer(many=True)


class AvailableRouteKeywordsDataSerializer(serializers.Serializer):
    available_route_keywords = serializers.ListField(child=serializers.CharField())
    keyword_routes = KeywordRoutesSerializer(many=True)
    route_id_available = serializers.ListField(child=serializers.CharField())


class AvailableRouteKeywordsResponseSerializer(serializers.Serializer):
    data = AvailableRouteKeywordsDataSerializer()


class GeoJSONFeatureCollectionSerializer(serializers.Serializer):
    type = serializers.CharField()
    features = serializers.ListField(child=serializers.JSONField())
    graphs = serializers.ListField(child=serializers.JSONField(), required=False)


class BoardingAlightingRoutesResponseSerializer(serializers.Serializer):
    data = GeoJSONFeatureCollectionSerializer()


class BoardingAlightingClickDetailDataSerializer(serializers.Serializer):
    summary = serializers.JSONField()


class BoardingAlightingClickDetailResponseSerializer(serializers.Serializer):
    data = BoardingAlightingClickDetailDataSerializer()


class SegmentDescriptorSerializer(serializers.Serializer):
    from_keyword = serializers.CharField()
    to_keyword = serializers.CharField()


class StopDescriptorSerializer(serializers.Serializer):
    keyword = serializers.CharField()


class SegmentStopSeriesItemSerializer(serializers.Serializer):
    time = serializers.CharField()
    value = serializers.IntegerField()


class SegmentStopStatsSerializer(serializers.Serializer):
    average = serializers.FloatField()
    maximum = serializers.IntegerField()
    total = serializers.IntegerField()


class SegmentStopAnalyticsDataSerializer(serializers.Serializer):
    segment = SegmentDescriptorSerializer(required=False)
    stop = StopDescriptorSerializer(required=False)
    series = SegmentStopSeriesItemSerializer(many=True)
    stats = SegmentStopStatsSerializer()


class SegmentStopAnalyticsResponseSerializer(serializers.Serializer):
    data = SegmentStopAnalyticsDataSerializer()


class RouteTripFilterSerializer(serializers.Serializer):
    route_id = serializers.CharField()
    trips = serializers.ListField(child=serializers.CharField())


class RouteGroupHierarchySerializer(serializers.Serializer):
    route_group = serializers.JSONField()
    routes = RouteTripFilterSerializer(many=True)


class SegmentStopFilterFlatSerializer(serializers.Serializer):
    route_groups = serializers.ListField(child=serializers.CharField())
    routes = serializers.ListField(child=serializers.CharField())
    trips = serializers.ListField(child=serializers.CharField())


class SegmentStopFilterSelectionSerializer(serializers.Serializer):
    mode = serializers.CharField()
    segment = SegmentDescriptorSerializer(required=False)
    stop = StopDescriptorSerializer(required=False)


class SegmentStopAnalyticsFilterDataSerializer(serializers.Serializer):
    selection = SegmentStopFilterSelectionSerializer()
    filters = serializers.JSONField()


class SegmentStopAnalyticsFilterResponseSerializer(serializers.Serializer):
    data = SegmentStopAnalyticsFilterDataSerializer()


class SegmentCatalogResponseSerializer(serializers.Serializer):
    data = GeoJSONFeatureCollectionSerializer()
