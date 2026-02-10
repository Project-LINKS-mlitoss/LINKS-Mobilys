from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class _PreserveExtraKeysMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance, dict):
            for k, v in instance.items():
                if k not in data:
                    data[k] = v
        return data


class RoutePatternsStopListItemResponseSerializer(BaseResponseSerializer):
    id = serializers.CharField()
    name = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    latlng = serializers.ListField(child=serializers.FloatField(), required=False, default=list)


class RoutePatternStopSequenceItemResponseSerializer(BaseResponseSerializer):
    stop_id = serializers.CharField()
    stop_name = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    stop_sequence = serializers.IntegerField()
    latlng = serializers.ListField(child=serializers.FloatField(), required=False, default=list)


class RoutePatternPatternResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    pattern_id = serializers.CharField()
    shape_id = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    direction_id = serializers.IntegerField(allow_null=True, required=False)
    service_id = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    segment = serializers.CharField(allow_blank=True, required=False, default="")

    stop_sequence = serializers.ListField(
        child=RoutePatternStopSequenceItemResponseSerializer(),
        required=False,
        default=list,
    )
    stop_ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    shape = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), required=False, default=list),
        required=False,
        default=list,
    )
    is_direction_id_generated = serializers.BooleanField(required=False, default=False)

    interval = serializers.IntegerField(required=False)
    pattern_hash = serializers.CharField(required=False, allow_null=True)
    trip_headsign = serializers.CharField(required=False, allow_blank=True, default="")


class RoutePatternRouteResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    route_id = serializers.CharField()
    route_short_name = serializers.CharField(allow_blank=True, required=False, default="")
    route_long_name = serializers.CharField(allow_blank=True, required=False, default="")
    route_type = serializers.IntegerField(allow_null=True, required=False)
    agency_id = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    patterns = serializers.ListField(child=RoutePatternPatternResponseSerializer(), required=False, default=list)


class RoutePatternsRetrieveResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    agency_ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    stops = serializers.ListField(child=RoutePatternsStopListItemResponseSerializer(), required=False, default=list)
    routes = serializers.ListField(child=RoutePatternRouteResponseSerializer(), required=False, default=list)


class RoutePatternsCreateResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    trip_id = serializers.CharField()
    route_id = serializers.CharField()
    translations_created = serializers.IntegerField()
    translations_updated = serializers.IntegerField()


class RoutePatternsCreateExistingResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    trip_id = serializers.CharField()
    message = serializers.CharField(required=False, allow_blank=True, default="")


class RoutePatternsDeleteResponseDataSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    deleted_trip_ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class RoutePatternsUpdateStopSequenceResponseDataSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    edited_trip_ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    stops_count = serializers.IntegerField(required=False, allow_null=True)
    new_shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

