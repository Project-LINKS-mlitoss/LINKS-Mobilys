# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

import re
from datetime import time

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer
from gtfs.constants import StopsGroupingMethod


class ExtendedTimeField(serializers.Field):
    """
    Handles GTFS "extended time" format (e.g., 24:35, 25:30).

    Internal value:
      {"time": datetime.time, "is_next_day": bool}
    """

    def to_representation(self, value):
        if value is None:
            return None
        if isinstance(value, time):
            return value.strftime("%H:%M:%S")
        return str(value)

    def to_internal_value(self, data):
        if data is None or data == "":
            raise serializers.ValidationError("This field is required.")

        if isinstance(data, time):
            return {"time": data, "is_next_day": False}

        if not isinstance(data, str):
            raise serializers.ValidationError(f"Invalid type. Expected string, got {type(data).__name__}.")

        pattern = r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$"
        match = re.match(pattern, data.strip())
        if not match:
            raise serializers.ValidationError(
                "Time has wrong format. Use HH:MM:SS or HH:MM (supports hours >= 24 for next day)."
            )

        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds = int(match.group(3)) if match.group(3) else 0

        if minutes >= 60:
            raise serializers.ValidationError("Minutes must be less than 60.")
        if seconds >= 60:
            raise serializers.ValidationError("Seconds must be less than 60.")

        # allow up to 27:00:00
        if hours > 27 or (hours == 27 and (minutes > 0 or seconds > 0)):
            raise serializers.ValidationError("Time cannot exceed 27:00:00.")

        is_next_day = False
        if hours >= 24:
            is_next_day = True
            hours = hours - 24

        try:
            parsed_time = time(hour=hours, minute=minutes, second=seconds)
        except ValueError as e:
            raise serializers.ValidationError(f"Invalid time value: {str(e)}") from e

        return {"time": parsed_time, "is_next_day": is_next_day}


class StopTimesCreateUpdateSerializer(BaseRequestSerializer):
    """
    Request serializer for nested stop_times in trip create/update.

    Converts extended time format to model-compatible fields:
    - arrival_time/departure_time as time
    - is_*_next_day flags
    """

    arrival_time = ExtendedTimeField()
    departure_time = ExtendedTimeField()
    stop_id = serializers.CharField(max_length=200)
    stop_sequence = serializers.IntegerField()
    stop_headsign = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    pickup_type = serializers.IntegerField(required=False, allow_null=True, default=None)
    drop_off_type = serializers.IntegerField(required=False, allow_null=True, default=None)
    shape_dist_traveled = serializers.FloatField(required=False, allow_null=True, default=None)
    timepoint = serializers.IntegerField(required=False, allow_null=True, default=None)

    def to_internal_value(self, data):
        data = dict(data)
        validated: dict = {}

        if "arrival_time" in data:
            arrival_result = ExtendedTimeField().to_internal_value(data["arrival_time"])
            validated["arrival_time"] = arrival_result["time"]
            validated["is_arrival_time_next_day"] = arrival_result["is_next_day"]
        else:
            raise serializers.ValidationError({"arrival_time": "This field is required."})

        if "departure_time" in data:
            departure_result = ExtendedTimeField().to_internal_value(data["departure_time"])
            validated["departure_time"] = departure_result["time"]
            validated["is_departure_time_next_day"] = departure_result["is_next_day"]
        else:
            raise serializers.ValidationError({"departure_time": "This field is required."})

        if "stop_id" not in data or not data["stop_id"]:
            raise serializers.ValidationError({"stop_id": "This field is required."})
        validated["stop_id"] = str(data["stop_id"])

        if "stop_sequence" not in data:
            raise serializers.ValidationError({"stop_sequence": "This field is required."})
        try:
            validated["stop_sequence"] = int(data["stop_sequence"])
        except (TypeError, ValueError):
            raise serializers.ValidationError({"stop_sequence": "A valid integer is required."})

        if "stop_headsign" in data:
            validated["stop_headsign"] = data.get("stop_headsign") or ""

        if "pickup_type" in data:
            pickup_type = data.get("pickup_type")
            validated["pickup_type"] = int(pickup_type) if pickup_type not in (None, "") else None

        if "drop_off_type" in data:
            drop_off_type = data.get("drop_off_type")
            validated["drop_off_type"] = int(drop_off_type) if drop_off_type not in (None, "") else None

        if "shape_dist_traveled" in data:
            shape_dist = data.get("shape_dist_traveled")
            validated["shape_dist_traveled"] = float(shape_dist) if shape_dist not in (None, "") else None

        if "timepoint" in data:
            timepoint = data.get("timepoint")
            validated["timepoint"] = int(timepoint) if timepoint not in (None, "") else None

        return validated


class StopEditRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(write_only=True, help_text="The scenario to process for stop editing.")
    stop_id = serializers.CharField(write_only=True, help_text="The ID of the stop to edit.")
    stop_name = serializers.CharField(write_only=True, help_text="The new name for the stop.")
    latitude = serializers.FloatField(write_only=True, help_text="The new latitude for the stop.")
    longitude = serializers.FloatField(write_only=True, help_text="The new longitude for the stop.")


class StopNameKeywordsUpdateSerializer(BaseRequestSerializer):
    """
    Request serializer for StopNameKeywords update endpoints.

    NOTE:
    - Kept name for backward compatibility.
    - Validation/normalization only (no ORM / no save).
    """

    stop_name_keyword = serializers.CharField(required=True, allow_blank=True)
    stop_group_id_label = serializers.CharField(required=True, allow_blank=True)
    stop_names_long = serializers.FloatField(required=True)
    stop_names_lat = serializers.FloatField(required=True)


class StopNameKeywordsPartialUpdateSerializer(BaseRequestSerializer):
    """Request serializer for StopNameKeywords PATCH endpoints."""

    stop_name_keyword = serializers.CharField(required=False, allow_blank=True)
    stop_group_id_label = serializers.CharField(required=False, allow_blank=True)
    stop_names_long = serializers.FloatField(required=False)
    stop_names_lat = serializers.FloatField(required=False)


class StopIdKeywordUpdateSerializer(BaseRequestSerializer):
    """
    Request serializer for StopIdKeyword update endpoints.

    NOTE:
    - Kept name for backward compatibility.
    - Validation/normalization only (no ORM / no save).
    """

    stop_id_keyword = serializers.CharField(required=True, allow_blank=True)
    stop_group_name_label = serializers.CharField(required=True, allow_blank=True)
    stop_id_long = serializers.FloatField(required=True)
    stop_id_lat = serializers.FloatField(required=True)


class StopIdKeywordPartialUpdateSerializer(BaseRequestSerializer):
    """Request serializer for StopIdKeyword PATCH endpoints."""

    stop_id_keyword = serializers.CharField(required=False, allow_blank=True)
    stop_group_name_label = serializers.CharField(required=False, allow_blank=True)
    stop_id_long = serializers.FloatField(required=False)
    stop_id_lat = serializers.FloatField(required=False)


class StopScenarioIdRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=True, help_text="Scenario ID (UUID).")


class StopsGroupingDataUpdateRequestSerializer(BaseRequestSerializer):
    stop_grouping_method = serializers.ChoiceField(choices=["stop_names", "stop_id"])
    group_changes = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class StopsGroupingMethodUpdateRequestSerializer(BaseRequestSerializer):
    grouping_method = serializers.ChoiceField(choices=[c[0] for c in StopsGroupingMethod.choices()])


class StopEditCreateRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField()
    stop_id = serializers.CharField()
    stop_name = serializers.CharField()
    stop_lat = serializers.FloatField()
    stop_lon = serializers.FloatField()
    stop_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    parent_stop_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    location_type = serializers.IntegerField(required=False, allow_null=True)
    translations = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class StopEditUpdateRequestSerializer(BaseRequestSerializer):
    stop_lat = serializers.FloatField()
    stop_lon = serializers.FloatField()
    stop_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    translations = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class StopsGroupDataCreateRequestSerializer(BaseRequestSerializer):
    stop_id = serializers.CharField(help_text="Stop group/prefix identifier (used to generate parent stop_id).")
    stop_name = serializers.CharField()
    stop_lat = serializers.FloatField()
    stop_lon = serializers.FloatField()
    scenario_id = serializers.CharField()
    stop_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    translations = serializers.ListField(child=serializers.DictField(), required=False, default=list)

