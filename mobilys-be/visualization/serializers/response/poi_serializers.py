# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers

from visualization.models import PointOfInterests


class POIListMetaSerializer(serializers.Serializer):
    count = serializers.IntegerField(required=False)
    note = serializers.CharField(required=False, allow_blank=True)
    bbox = serializers.JSONField(required=False)
    zoom = serializers.IntegerField(required=False)
    dataset_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    categories = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    filtered_by_polygon = serializers.BooleanField(required=False)
    batch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class POIByBBoxResponseSerializer(serializers.Serializer):
    items = serializers.ListField()
    meta = POIListMetaSerializer()


class POIDBByBBoxResponseSerializer(serializers.Serializer):
    items = serializers.ListField()
    meta = POIListMetaSerializer()


class POIActiveBatchResponseSerializer(serializers.Serializer):
    project_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    batch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)


class POICheckBatchSerializer(serializers.Serializer):
    file = serializers.CharField()
    proposed_batch_name = serializers.CharField(required=False, allow_blank=True)
    file_name_taken = serializers.BooleanField(required=False)
    can_commit = serializers.BooleanField(required=False)
    stats = serializers.JSONField(required=False)
    valid_rows = serializers.JSONField(required=False)
    invalid_rows = serializers.JSONField(required=False)


class POICheckResponseSerializer(serializers.Serializer):
    total_files = serializers.IntegerField()
    total_valid_rows = serializers.IntegerField()
    batches = POICheckBatchSerializer(many=True)
    checked_at = serializers.CharField()


class POIGroupedResponseSerializer(serializers.Serializer):
    total = serializers.IntegerField(required=False)
    group_count = serializers.IntegerField(required=False)
    groups = serializers.ListField(required=False)
    generated_at = serializers.CharField(required=False)
    active_batch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class POIListResponseSerializer(serializers.Serializer):
    items = serializers.ListField(required=False)
    active_batch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class POIUploadResponseSerializer(serializers.Serializer):
    total_created = serializers.IntegerField()
    batches = serializers.ListField()
    uploaded_at = serializers.CharField()


class PointOfInterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointOfInterests
        fields = ["id", "type", "name", "lat", "lng", "remark"]
