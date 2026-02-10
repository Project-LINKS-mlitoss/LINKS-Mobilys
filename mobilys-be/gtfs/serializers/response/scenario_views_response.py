from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class UUIDStringField(serializers.Field):
    def to_representation(self, value):
        if value is None:
            return None
        if isinstance(value, UUID):
            return str(value)
        return value


class IsoDateTimeStringField(serializers.Field):
    def to_representation(self, value):
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return value


class _PreserveExtraKeysMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(instance, dict):
            for k, v in instance.items():
                if k not in data:
                    data[k] = v
        return data


class ScenarioLocalListItemResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    id = UUIDStringField()
    scenario_name = serializers.CharField()
    gtfs_filename = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    created_datetime = IsoDateTimeStringField(required=False, allow_null=True)
    updated_datetime = IsoDateTimeStringField(required=False, allow_null=True)

    source_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    start_date = IsoDateTimeStringField(required=False, allow_null=True)
    end_date = IsoDateTimeStringField(required=False, allow_null=True)

    source_scenario_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    osm_graph_status = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    drm_graph_status = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    edited_data = serializers.JSONField(required=False, allow_null=True)
    edit_state = serializers.JSONField(required=False, allow_null=True)

    scenario_source = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_owned = serializers.BooleanField(required=False, allow_null=True)
    owner_username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    owner_email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    project_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ScenarioImportResultDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    filename = serializers.CharField()
    scenario_id = UUIDStringField()


class ScenarioUpdateDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    id = UUIDStringField()
    gtfs_filename = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    created_datetime = IsoDateTimeStringField(required=False, allow_null=True)
    updated_datetime = IsoDateTimeStringField(required=False, allow_null=True)
    scenario_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    start_date = IsoDateTimeStringField(required=False, allow_null=True)
    end_date = IsoDateTimeStringField(required=False, allow_null=True)


class ScenarioCloneDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    new_scenario = ScenarioLocalListItemResponseSerializer()


class ScenarioDuplicationCandidateItemResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    id = UUIDStringField()
    scenario_name = serializers.CharField()
    scenario_source = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    project_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    start_date = IsoDateTimeStringField(required=False, allow_null=True)
    end_date = IsoDateTimeStringField(required=False, allow_null=True)


class ScenarioDuplicationCandidatesDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    scenarios = serializers.ListField(child=ScenarioDuplicationCandidateItemResponseSerializer(), required=False, default=list)


class ScenarioGraphStatusDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    osm_graph_status = serializers.CharField()
    drm_graph_status = serializers.CharField()


class ScenarioRetrieveDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    feed_publisher_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    feed_publisher_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    feed_lang = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    feed_start_date = IsoDateTimeStringField(required=False, allow_null=True)
    feed_end_date = IsoDateTimeStringField(required=False, allow_null=True)
    feed_version = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scenario_prefecture = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scenario_region = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    import_info = serializers.DictField(required=False, default=dict)


class ScenarioEditContextFeedInfoResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    publisher_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    version = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    language = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    publisher_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    start_date = IsoDateTimeStringField(required=False, allow_null=True)
    end_date = IsoDateTimeStringField(required=False, allow_null=True)


class ScenarioEditContextCalendarRowResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    service_id = serializers.CharField()
    monday = serializers.IntegerField()
    tuesday = serializers.IntegerField()
    wednesday = serializers.IntegerField()
    thursday = serializers.IntegerField()
    friday = serializers.IntegerField()
    saturday = serializers.IntegerField()
    sunday = serializers.IntegerField()
    start_date = IsoDateTimeStringField()
    end_date = IsoDateTimeStringField()


class ScenarioEditContextCalendarDatesRowResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    service_id = serializers.CharField()
    date = IsoDateTimeStringField()
    exception_type = serializers.IntegerField()


class ScenarioEditContextDataResponseSerializer(_PreserveExtraKeysMixin, BaseResponseSerializer):
    scenario_name = serializers.CharField()
    start_date = IsoDateTimeStringField(required=False, allow_null=True)
    end_date = IsoDateTimeStringField(required=False, allow_null=True)
    feed_info = ScenarioEditContextFeedInfoResponseSerializer(required=False, allow_null=True)
    calendar = serializers.ListField(child=ScenarioEditContextCalendarRowResponseSerializer(), required=False, default=list)
    calendar_dates = serializers.ListField(
        child=ScenarioEditContextCalendarDatesRowResponseSerializer(),
        required=False,
        default=list,
    )

