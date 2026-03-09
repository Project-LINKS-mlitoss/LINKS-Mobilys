# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class ScenarioListRequestSerializer(BaseRequestSerializer):
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ScenarioRetrieveRequestSerializer(BaseRequestSerializer):
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ScenarioDuplicationCandidatesRequestSerializer(BaseRequestSerializer):
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class ScenarioExportGtfsRequestSerializer(BaseRequestSerializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    files = serializers.ListField(child=serializers.CharField(), required=False)

