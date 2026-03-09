# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers

from gtfs.serializers.base import BaseRequestSerializer


class RidershipUploadRequestSerializer(BaseRequestSerializer):
    VALIDATION_MODE_CHOICES = [
        ("railway", "Railway"),
        ("bus_ic", "Bus (IC)"),
        ("bus_cash", "Bus (Cash)"),
    ]

    file = serializers.FileField(required=True)
    ridership_record_name = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    validation_mode = serializers.ChoiceField(choices=VALIDATION_MODE_CHOICES, required=False, default="railway")

    def validate_file(self, value):
        allowed_extensions = [".xlsx", ".xls", ".csv"]
        file_name = value.name.lower()

        if not any(file_name.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError("Invalid file format. Upload a .xlsx, .xls, or .csv file.")

        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError("File size too large. Maximum is 50MB.")

        return value

