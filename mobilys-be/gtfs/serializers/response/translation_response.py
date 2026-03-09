# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.models import Translation


class TranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Translation
        fields = [
            "id",
            "table_name",
            "field_name",
            "field_value",
            "record_id",
            "record_sub_id",
            "language",
            "translation",
            "route_id",
            "trip_id",
            "service_id",
            "stop_id",
            "shape_id",
            "feed_info_id",
            "scenario_id",
        ]

