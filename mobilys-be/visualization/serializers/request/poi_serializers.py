# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers


class POIByBBoxQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    zoom = serializers.IntegerField(required=False)
    dataset_id = serializers.CharField(required=False, allow_blank=True)
    categories = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(required=False)
    page_size = serializers.IntegerField(required=False)
    batch = serializers.CharField(required=False, allow_blank=True)


class POIDBByBBoxQuerySerializer(serializers.Serializer):
    scenario_id = serializers.UUIDField(required=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    batch = serializers.CharField(required=False, allow_blank=True)
    limit = serializers.IntegerField(required=False)


class POISetActiveBatchSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(required=False, allow_null=True)
    batch_id = serializers.CharField(required=True)


class POICheckRequestSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(required=False, allow_null=True)


class POIBatchDownloadQuerySerializer(serializers.Serializer):
    batch_id = serializers.CharField(required=True)


class POIQuerySerializer(serializers.Serializer):
    type = serializers.CharField(required=False, allow_blank=True)
    batch = serializers.CharField(required=False, allow_blank=True)
    grouped = serializers.CharField(required=False, allow_blank=True)
    group_by = serializers.CharField(required=False, allow_blank=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)


class POIBatchUploadSerializer(serializers.Serializer):
    batches = serializers.ListField(required=False, allow_empty=True)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    remark = serializers.CharField(required=False, allow_blank=True)
