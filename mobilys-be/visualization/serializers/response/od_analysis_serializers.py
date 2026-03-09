# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class ODUploadResponseSerializer(serializers.Serializer):
    stopid_geton = serializers.JSONField()
    stopid_getoff = serializers.JSONField()
    total_data_stopid_geton_uploaded = serializers.IntegerField()
    available_geton_data = serializers.IntegerField()
    not_available_geton_data = serializers.IntegerField()
    total_data_stopid_getoff_uploaded = serializers.IntegerField()
    available_getoff_data = serializers.IntegerField()
    not_available_getoff_data = serializers.IntegerField()
    invalid_data = serializers.JSONField()


class ODUsageDistributionResponseSerializer(serializers.Serializer):
    geojson = serializers.JSONField()
    date_options = serializers.JSONField()
    table_data = serializers.JSONField(allow_null=True)
    invalid_data = serializers.JSONField()
    valid_count = serializers.IntegerField()
    invalid_count = serializers.IntegerField()


class ODLastFirstStopResponseSerializer(serializers.Serializer):
    geojson = serializers.JSONField()
    date_options = serializers.JSONField()
    table_data = serializers.JSONField(allow_null=True)


class ODBusStopResponseSerializer(serializers.Serializer):
    bus_stop_data = serializers.JSONField()
    date_options = serializers.JSONField()
