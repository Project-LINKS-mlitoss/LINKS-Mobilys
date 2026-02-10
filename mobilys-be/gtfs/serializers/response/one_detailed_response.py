from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class OneDetailedConversionValidationErrorResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    errors = serializers.DictField()


class OneDetailedToBoardingAlightingMetadataResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    source_type = serializers.CharField()
    total_input_rows = serializers.IntegerField()
    total_output_rows = serializers.IntegerField()
    error_count = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    csv_content = serializers.CharField()


class OneDetailedToODMetadataResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    source_type = serializers.CharField()
    total_input_rows = serializers.IntegerField()
    total_output_rows = serializers.IntegerField()
    error_count = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    csv_content = serializers.CharField()
