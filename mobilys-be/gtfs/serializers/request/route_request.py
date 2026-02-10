from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class RouteKeywordDataSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(write_only=True, help_text="The scenario to process for route grouping.")
    route_group_keyword_id = serializers.CharField(write_only=True, help_text="The keyword ID to group routes by.")
    color = serializers.CharField(write_only=True, help_text="The color to assign to the grouped routes.")


class RoutesGroupingDataRetrieveRequestSerializer(BaseRequestSerializer):
    kw = serializers.CharField(required=False, allow_blank=True, default="")


class RoutesGroupingApplyChangesRequestSerializer(BaseRequestSerializer):
    group_changes = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class RouteKeywordUpdateColorRequestSerializer(BaseRequestSerializer):
    color = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RouteGroupKeywordCreateRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    keyword = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    color = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RouteGroupKeywordDeleteRequestSerializer(BaseRequestSerializer):
    keyword = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RouteGroupKeywordRenameRequestSerializer(BaseRequestSerializer):
    keyword = serializers.CharField(required=False, allow_blank=True, allow_null=True)

