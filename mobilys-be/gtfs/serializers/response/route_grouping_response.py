from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class RoutesGroupingDataResponseSerializer(BaseResponseSerializer):
    routes_grouped_by_keyword = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    filter_options = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    geojson = serializers.DictField(required=False, default=dict)


class RoutesGroupingApplyChangesDataResponseSerializer(BaseResponseSerializer):
    updated_count = serializers.IntegerField()
    updated_routes = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class RouteKeywordUpdateColorResponseSerializer(BaseResponseSerializer):
    route_group_keyword_id = serializers.CharField()
    color = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RouteGroupKeywordCreateResponseSerializer(BaseResponseSerializer):
    id = serializers.CharField()
    keyword = serializers.CharField()
    scenario_id = serializers.CharField()
    keyword_color = serializers.CharField(required=False, allow_blank=True, default="")


class RouteGroupKeywordDeleteDataResponseSerializer(BaseResponseSerializer):
    related_route_ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class RouteGroupKeywordRenameDataResponseSerializer(BaseResponseSerializer):
    id = serializers.CharField()
    keyword = serializers.CharField()

