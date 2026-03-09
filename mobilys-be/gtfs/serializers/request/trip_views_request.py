# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer
from gtfs.serializers.request.trip_request import TripUpsertRequestSerializer


class TripListRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=True)


class TripCreateRequestSerializer(TripUpsertRequestSerializer):
    pass


class PreviewShapeCoordinatesRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=True)
    stop_ids = serializers.ListField(child=serializers.CharField(), allow_empty=False)


class TripEditGetRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=True)
    trip_id = serializers.CharField(required=True)


class TripEditPutPatchRequestSerializer(BaseRequestSerializer):
    data = serializers.DictField(required=False, default=dict)


class TripBulkDeleteRequestSerializer(BaseRequestSerializer):
    scenario_id = serializers.CharField(required=True)
    trip_ids = serializers.ListField(child=serializers.CharField(), allow_empty=False)

