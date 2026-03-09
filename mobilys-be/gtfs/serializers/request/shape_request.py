# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class GenerateShapeSerializer(BaseRequestSerializer):
    trips = serializers.ListField(child=serializers.CharField(), write_only=True, help_text="Trip IDs to generate shapes from.")
    routes = serializers.ListField(child=serializers.CharField(), write_only=True, help_text="Route IDs to generate shapes from.")
    isAllData = serializers.BooleanField(default=False, write_only=True, help_text="If true, generate shapes for all trips and routes in the scenario.")
    scenario_id = serializers.CharField(write_only=True, help_text="The scenario to generate shapes for.")


class ShapePointPatchSerializer(BaseRequestSerializer):
    shape_id = serializers.CharField()
    shape_pt_sequence = serializers.IntegerField(min_value=0)
    shape_pt_lat = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    shape_pt_lon = serializers.FloatField(required=False, min_value=-180.0, max_value=180.0)
    shape_dist_traveled = serializers.FloatField(required=False, allow_null=True)

    def validate(self, attrs):
        if (
            "shape_pt_lat" not in attrs
            and "shape_pt_lon" not in attrs
            and "shape_dist_traveled" not in attrs
        ):
            raise serializers.ValidationError(
                "At least one of shape_pt_lat, shape_pt_lon, shape_dist_traveled is required."
            )
        return attrs


class BulkShapeUpdateSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=False)
    upsert = serializers.BooleanField(required=False, default=False)
    shapes = ShapePointPatchSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        items = attrs.get("shapes") or []
        seen = set()
        dups = []
        for it in items:
            key = (it.get("shape_id"), it.get("shape_pt_sequence"))
            if key in seen:
                dups.append({"shape_id": key[0], "shape_pt_sequence": key[1]})
            seen.add(key)
        if dups:
            raise serializers.ValidationError({"shapes": {"duplicates": dups}})
        return attrs


class GenerateShapeFromStopsSerializer(BaseRequestSerializer):
    stops = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        help_text="List of stop dictionaries with coordinate fields.",
    )
    route_type = serializers.IntegerField(required=False, default=3)
    coordinate_keys = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=["stop_lon", "stop_lat"],
        help_text="Two strings: [lon_key, lat_key].",
    )

    def validate_coordinate_keys(self, value):
        if not isinstance(value, (list, tuple)) or len(value) != 2:
            raise serializers.ValidationError("coordinate_keys must be a list of two strings: [lon_key, lat_key].")
        return value


class GenerateShapeFromCoordinatesOnlySerializer(BaseRequestSerializer):
    coordinates = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2),
        min_length=2,
        allow_empty=False,
        help_text="List of [lon, lat] pairs (or [lat, lon] if coord_format=lat_lon).",
    )
    route_type = serializers.IntegerField(required=False, default=3)
    coord_format = serializers.ChoiceField(required=False, default="lon_lat", choices=["lon_lat", "lat_lon"])


class TripPatternShapeUpdateSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField()
    route_id = serializers.CharField()
    service_id = serializers.CharField()
    direction_id = serializers.IntegerField(required=False, allow_null=True)
    trip_headsign = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pattern_hash = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ShapeCoordinateCreateSerializer(BaseRequestSerializer):
    shape_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    shape_pt_sequence = serializers.IntegerField(min_value=1)
    shape_pt_lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    shape_pt_lon = serializers.FloatField(min_value=-180.0, max_value=180.0)
    shape_dist_traveled = serializers.FloatField(required=False, allow_null=True)


class ShapeCreatePayloadSerializer(BaseRequestSerializer):
    shape_id = serializers.CharField()
    coordinates = ShapeCoordinateCreateSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        shape_id = attrs.get("shape_id")
        coords = attrs.get("coordinates") or []

        seen_seq = set()
        dup_seq = []
        mismatched_shape_id = []

        for it in coords:
            seq = it.get("shape_pt_sequence")
            if seq in seen_seq:
                dup_seq.append(seq)
            seen_seq.add(seq)

            it_shape_id = it.get("shape_id")
            if it_shape_id and it_shape_id != shape_id:
                mismatched_shape_id.append({"shape_id": it_shape_id, "shape_pt_sequence": seq})

        if dup_seq:
            raise serializers.ValidationError({"coordinates": {"duplicate_sequences": sorted(set(dup_seq))}})
        if mismatched_shape_id:
            raise serializers.ValidationError({"coordinates": {"shape_id_mismatch": mismatched_shape_id}})

        return attrs


class CreateShapeFromTripPatternsSerializer(BaseRequestSerializer):
    trip_patterns = TripPatternShapeUpdateSerializer(many=True, allow_empty=False)
    shape = ShapeCreatePayloadSerializer()

    def validate(self, attrs):
        patterns = attrs.get("trip_patterns") or []

        scenario_ids = {p.get("scenario_id") for p in patterns if p.get("scenario_id")}
        if len(scenario_ids) != 1:
            raise serializers.ValidationError(
                {"trip_patterns": {"scenario_id": "All trip_patterns must share the same scenario_id."}}
            )

        return attrs

