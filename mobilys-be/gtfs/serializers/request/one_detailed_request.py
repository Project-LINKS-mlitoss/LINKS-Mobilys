from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class OneDetailedToBoardingAlightingSerializer(BaseRequestSerializer):
    scenario_id = serializers.UUIDField(required=True, help_text="Scenario UUID for stop_sequence lookup")
    file = serializers.FileField(required=False, help_text="Excel (.xlsx, .xls) or CSV file containing OneDetailed data")
    ridership_upload_id = serializers.UUIDField(required=False, help_text="UUID of existing RidershipUpload to convert from database records")

    def validate_file(self, value):
        if value is None:
            return value

        filename = value.name.lower()
        supported_extensions = [".xlsx", ".xls", ".csv"]

        if not any(filename.endswith(ext) for ext in supported_extensions):
            raise serializers.ValidationError(
                f"Unsupported file format. Supported formats: {', '.join(supported_extensions)}"
            )

        return value

    def validate(self, attrs):
        file = attrs.get("file")
        ridership_upload_id = attrs.get("ridership_upload_id")

        if not file and not ridership_upload_id:
            raise serializers.ValidationError("Either 'file' or 'ridership_upload_id' must be provided.")

        if file and ridership_upload_id:
            raise serializers.ValidationError("Provide either 'file' or 'ridership_upload_id', not both.")

        return attrs


class OneDetailedToODSerializer(BaseRequestSerializer):
    scenario_id = serializers.UUIDField(required=True, help_text="Scenario UUID for data lookup")
    file = serializers.FileField(required=False, help_text="Excel (.xlsx, .xls) or CSV file containing OneDetailed data")
    ridership_upload_id = serializers.UUIDField(required=False, help_text="UUID of existing RidershipUpload to convert from database records")

    def validate_file(self, value):
        if value is None:
            return value

        filename = value.name.lower()
        supported_extensions = [".xlsx", ".xls", ".csv"]

        if not any(filename.endswith(ext) for ext in supported_extensions):
            raise serializers.ValidationError(
                f"Unsupported file format. Supported formats: {', '.join(supported_extensions)}"
            )

        return value

    def validate(self, attrs):
        file = attrs.get("file")
        ridership_upload_id = attrs.get("ridership_upload_id")

        if not file and not ridership_upload_id:
            raise serializers.ValidationError("Either 'file' or 'ridership_upload_id' must be provided.")

        if file and ridership_upload_id:
            raise serializers.ValidationError("Provide either 'file' or 'ridership_upload_id', not both.")

        return attrs

