from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class StopsGroupingDataRetrieveResponseDataSerializer(BaseResponseSerializer):
    grouping_method = serializers.CharField()
    stops_groups_by_name = serializers.JSONField()
    stops_groups_by_id = serializers.JSONField()


class StopsGroupingDataUpdateResponseDataSerializer(BaseResponseSerializer):
    updated_count = serializers.IntegerField()
    updated_stops = serializers.ListField(child=serializers.CharField(), required=False)


class StopsGroupingMethodUpdateResponseDataSerializer(BaseResponseSerializer):
    scenario_id = serializers.CharField()
    stops_grouping_method = serializers.CharField()


class StopEditCreateResponseDataSerializer(BaseResponseSerializer):
    stop_id = serializers.CharField()
    stop_name_group_id = serializers.IntegerField()
    stop_id_group_id = serializers.IntegerField()
    translations_created = serializers.IntegerField(required=False)
    translations_updated = serializers.IntegerField(required=False)


class StopEditUpdateResponseDataSerializer(BaseResponseSerializer):
    stop_id = serializers.CharField()
    stop_lat = serializers.JSONField()
    stop_lon = serializers.JSONField()
    stop_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    translations_created = serializers.IntegerField(required=False)
    translations_updated = serializers.IntegerField(required=False)


class StopEditListStopResponseSerializer(BaseResponseSerializer):
    stop_id = serializers.CharField()
    stop_name = serializers.CharField()
    stop_lat = serializers.JSONField(required=False, allow_null=True)
    stop_lon = serializers.JSONField(required=False, allow_null=True)
    location_type = serializers.IntegerField(required=False, allow_null=True)
    parent_station = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class StopEditListGroupResponseSerializer(BaseResponseSerializer):
    parent_station = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stops = StopEditListStopResponseSerializer(many=True)


class StopsGroupDataCreateResponseDataSerializer(BaseResponseSerializer):
    stop_id = serializers.CharField()
    stop_name_group_id = serializers.IntegerField()
    stop_id_group_id = serializers.IntegerField()
    stop_name_group_label = serializers.CharField()


class StopNameKeywordsResponseDataSerializer(BaseResponseSerializer):
    stop_group_id = serializers.IntegerField()
    stop_name_keyword = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_group_id_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_names_lat = serializers.FloatField(required=False, allow_null=True)
    stop_names_long = serializers.FloatField(required=False, allow_null=True)


class StopIdKeywordResponseDataSerializer(BaseResponseSerializer):
    stop_group_id = serializers.IntegerField()
    stop_id_keyword = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_group_name_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stop_id_lat = serializers.FloatField(required=False, allow_null=True)
    stop_id_long = serializers.FloatField(required=False, allow_null=True)

