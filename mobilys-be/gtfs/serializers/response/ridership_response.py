# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from rest_framework import serializers

from gtfs.serializers.base import BaseResponseSerializer


class UUIDStringField(serializers.Field):
    def to_representation(self, value):
        if value is None:
            return None
        if isinstance(value, UUID):
            return str(value)
        return value


class IsoDateTimeStringField(serializers.Field):
    def to_representation(self, value):
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return value


class RidershipValidationFailedResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    error = serializers.DictField()


class RidershipExportErrorResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    message = serializers.CharField()


class RidershipPaginationSerializer(BaseResponseSerializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_count = serializers.IntegerField()
    total_pages = serializers.IntegerField()


class RidershipUploadErrorSerializer(BaseResponseSerializer):
    id = UUIDStringField()
    source_row_number = serializers.IntegerField()
    error_type = serializers.CharField()
    field_name = serializers.CharField(allow_blank=True)
    error_message = serializers.CharField()
    raw_data = serializers.JSONField(required=False, allow_null=True)
    description = serializers.CharField(allow_blank=True, required=False)


class RidershipRecordSerializer(BaseResponseSerializer):
    id = serializers.IntegerField(read_only=True)
    source_row_number = serializers.IntegerField(allow_null=True)
    ridership_record_id = serializers.IntegerField()
    ic_card_agency_identification_code = serializers.CharField()
    boarding_station_code = serializers.CharField()
    boarding_station_name = serializers.CharField(allow_blank=True)
    alighting_station_code = serializers.CharField()
    alighting_station_name = serializers.CharField(allow_blank=True)
    payment_at = IsoDateTimeStringField()
    boarding_at = IsoDateTimeStringField()
    alighting_at = IsoDateTimeStringField()
    route_id = serializers.CharField(required=False, allow_blank=True, default="")
    route_name = serializers.CharField(required=False, allow_blank=True, default="")
    trip_code = serializers.CharField(required=False, allow_blank=True, default="")
    adult_passenger_count = serializers.IntegerField(required=False, allow_null=True)
    child_passenger_count = serializers.IntegerField(required=False, allow_null=True)


class RidershipUploadResponseSerializer(BaseResponseSerializer):
    id = UUIDStringField()
    scenario_id = UUIDStringField(required=False, allow_null=True)
    ridership_record_name = serializers.CharField()
    file_name = serializers.CharField()
    file_size = serializers.IntegerField(allow_null=True)
    upload_status = serializers.CharField()
    validation_mode = serializers.CharField(required=False)
    total_rows = serializers.IntegerField()
    success_rows = serializers.IntegerField()
    error_count = serializers.IntegerField()
    description = serializers.CharField(allow_blank=True)
    max_tolerance_time = serializers.IntegerField(allow_null=True)
    file_type = serializers.CharField(required=False, allow_blank=True, default="")
    uploaded_at = IsoDateTimeStringField()
    processed_at = IsoDateTimeStringField()
    errors = RidershipUploadErrorSerializer(many=True, required=False)
    records = RidershipRecordSerializer(many=True, required=False)
    errors_truncated = serializers.BooleanField(required=False)
    total_errors = serializers.IntegerField(required=False)


class RidershipUploadCreateResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = RidershipUploadResponseSerializer(required=False)


class RidershipUploadListSerializer(BaseResponseSerializer):
    id = UUIDStringField()
    ridership_record_name = serializers.CharField()
    file_name = serializers.CharField()
    file_size = serializers.IntegerField(allow_null=True)
    upload_status = serializers.CharField()
    total_rows = serializers.IntegerField()
    success_rows = serializers.IntegerField()
    error_count = serializers.IntegerField(required=False, default=0)
    description = serializers.CharField(allow_blank=True)
    max_tolerance_time = serializers.IntegerField(required=False, allow_null=True)
    uploaded_at = IsoDateTimeStringField()
    processed_at = IsoDateTimeStringField()
    scenario_id = UUIDStringField(required=False, allow_null=True)


class RidershipUploadDetailSerializer(BaseResponseSerializer):
    id = UUIDStringField()
    ridership_record_name = serializers.CharField()
    file_name = serializers.CharField()
    file_size = serializers.IntegerField(allow_null=True)
    upload_status = serializers.CharField()
    total_rows = serializers.IntegerField()
    success_rows = serializers.IntegerField()
    error_count = serializers.IntegerField(required=False, default=0)
    description = serializers.CharField(allow_blank=True)
    max_tolerance_time = serializers.IntegerField(allow_null=True)
    uploaded_at = IsoDateTimeStringField()
    processed_at = IsoDateTimeStringField()
    errors = RidershipUploadErrorSerializer(many=True, required=False, default=list)
    scenario_id = UUIDStringField(required=False, allow_null=True)
    total_error_count = serializers.IntegerField(required=False, allow_null=True)
    error_group_count = serializers.IntegerField(required=False, allow_null=True)
    error_summary = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class RidershipUploadListResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    data = RidershipUploadListSerializer(many=True)
    pagination = RidershipPaginationSerializer()


class RidershipUploadErrorDetailSerializer(BaseResponseSerializer):
    id = serializers.CharField()
    source_row_number = serializers.IntegerField(allow_null=True)
    error_message = serializers.CharField()
    raw_data = serializers.JSONField(required=False, allow_null=True)


class RidershipUploadErrorDetailsPaginationSerializer(BaseResponseSerializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_count = serializers.IntegerField()
    total_pages = serializers.IntegerField()


class RidershipUploadErrorSummaryItemSerializer(BaseResponseSerializer):
    error_type = serializers.CharField()
    error_type_display = serializers.CharField()
    field_name = serializers.CharField(allow_blank=True, required=False, default="")
    field_display_name = serializers.CharField()
    group_key = serializers.CharField()
    total_count = serializers.IntegerField()
    affected_rows = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    affected_rows_truncated = serializers.BooleanField(required=False, default=False)
    sample_message = serializers.CharField(required=False, allow_blank=True, default="")
    details = RidershipUploadErrorDetailSerializer(many=True, required=False, default=list)
    details_truncated = serializers.BooleanField(required=False, default=False)
    details_pagination = RidershipUploadErrorDetailsPaginationSerializer(required=False, allow_null=True)


class RidershipUploadDetailDataSerializer(BaseResponseSerializer):
    id = UUIDStringField()
    scenario_id = UUIDStringField()
    ridership_record_name = serializers.CharField()
    file_name = serializers.CharField()
    file_size = serializers.IntegerField(allow_null=True)
    upload_status = serializers.CharField()
    total_rows = serializers.IntegerField()
    success_rows = serializers.IntegerField()
    total_error_count = serializers.IntegerField()
    error_group_count = serializers.IntegerField()
    description = serializers.CharField(allow_blank=True)
    uploaded_at = IsoDateTimeStringField()
    processed_at = IsoDateTimeStringField()
    error_summary = RidershipUploadErrorSummaryItemSerializer(many=True, required=False, default=list)


class RidershipUploadDetailResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    data = RidershipUploadDetailDataSerializer()


class RidershipDeleteUploadResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    message = serializers.CharField()


class RidershipRecordListItemSerializer(BaseResponseSerializer):
    id = serializers.IntegerField()
    ridership_upload_id = UUIDStringField(allow_null=True)
    source_row_number = serializers.IntegerField(allow_null=True)
    ridership_record_id = serializers.IntegerField()
    ic_card_agency_identification_code = serializers.CharField()
    boarding_station_code = serializers.CharField()
    boarding_station_name = serializers.CharField(allow_blank=True)
    alighting_station_code = serializers.CharField()
    alighting_station_name = serializers.CharField(allow_blank=True)
    boarding_at = IsoDateTimeStringField()
    alighting_at = IsoDateTimeStringField()
    payment_at = IsoDateTimeStringField()
    route_id = serializers.CharField(required=False, allow_blank=True, default="")
    route_name = serializers.CharField(required=False, allow_blank=True, default="")
    trip_code = serializers.CharField(required=False, allow_blank=True, default="")
    adult_passenger_count = serializers.IntegerField(required=False, allow_null=True)
    child_passenger_count = serializers.IntegerField(required=False, allow_null=True)


class RidershipRecordListResponseSerializer(BaseResponseSerializer):
    success = serializers.BooleanField()
    data = RidershipRecordListItemSerializer(many=True)
    pagination = RidershipPaginationSerializer()

