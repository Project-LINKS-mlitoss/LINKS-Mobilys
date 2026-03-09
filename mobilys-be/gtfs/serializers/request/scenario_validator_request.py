# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class ScenarioValidateLocalRequestSerializer(BaseRequestSerializer):
    scenario_name = serializers.CharField(max_length=255)
    gtfs_zip = serializers.FileField(required=True)

    def validate_gtfs_zip(self, value):
        if not value or not value.name.lower().endswith(".zip"):
            raise serializers.ValidationError("Invalid file format. Please upload a .zip file.")
        return value


class ScenarioValidateApiRequestSerializer(BaseRequestSerializer):
    organization_id = serializers.CharField()
    feed_id = serializers.CharField()
    scenario_name = serializers.CharField()
    gtfs_file_uid = serializers.CharField(required=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

