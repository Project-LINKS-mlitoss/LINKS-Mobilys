from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class ScenarioLocalCreateRequestSerializer(BaseRequestSerializer):
    scenario_name = serializers.CharField(max_length=255)
    gtfs_zip = serializers.FileField(required=True)

    def validate_gtfs_zip(self, value):
        if not value or not value.name.lower().endswith(".zip"):
            raise serializers.ValidationError("Invalid file format. Please upload a .zip file.")
        return value


class ScenarioAPICreateRequestSerializer(BaseRequestSerializer):
    organization_id = serializers.CharField()
    feed_id = serializers.CharField()
    scenario_name = serializers.CharField()
    gtfs_file_uid = serializers.CharField(required=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)


class CloneScenarioSerializer(BaseRequestSerializer):
    new_scenario_name = serializers.CharField(max_length=200)
    source_scenario_id = serializers.UUIDField()


class CalendarRowSerializer(BaseRequestSerializer):
    service_id = serializers.CharField()
    monday = serializers.IntegerField()
    tuesday = serializers.IntegerField()
    wednesday = serializers.IntegerField()
    thursday = serializers.IntegerField()
    friday = serializers.IntegerField()
    saturday = serializers.IntegerField()
    sunday = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()


class CalendarDatesRowSerializer(BaseRequestSerializer):
    service_id = serializers.CharField()
    date = serializers.DateField()
    exception_type = serializers.IntegerField(min_value=1, max_value=2)


class FeedInfoSerializer(BaseRequestSerializer):
    publisher_name = serializers.CharField(required=False, allow_blank=True)
    publisher_url = serializers.URLField(required=False, allow_blank=True)
    language = serializers.CharField(required=False, allow_blank=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    version = serializers.CharField(required=False, allow_blank=True)
    default_lang = serializers.CharField(required=False, allow_blank=True)
    feed_contact_email = serializers.EmailField(required=False, allow_blank=True)
    feed_contact_url = serializers.URLField(required=False, allow_blank=True)

    feed_publisher_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    feed_publisher_url = serializers.URLField(required=False, allow_blank=True, write_only=True)
    feed_lang = serializers.CharField(required=False, allow_blank=True, write_only=True)
    feed_start_date = serializers.DateField(required=False, write_only=True)
    feed_end_date = serializers.DateField(required=False, write_only=True)
    feed_version = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        key_map = {
            "feed_publisher_name": "publisher_name",
            "feed_publisher_url": "publisher_url",
            "feed_lang": "language",
            "feed_start_date": "start_date",
            "feed_end_date": "end_date",
            "feed_version": "version",
        }

        for old_key, new_key in key_map.items():
            if new_key not in attrs and old_key in attrs:
                attrs[new_key] = attrs[old_key]

        return attrs


class ScenarioUpdateSerializer(BaseRequestSerializer):
    scenario_name = serializers.CharField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    feed_info = FeedInfoSerializer(required=False)
    calendar = CalendarRowSerializer(many=True, required=False)
    calendar_dates = CalendarDatesRowSerializer(many=True, required=False)

    def validate(self, data):
        s = data.get("start_date")
        e = data.get("end_date")
        if s and e and e < s:
            raise serializers.ValidationError("end_date must be on or after start_date.")
        return data

