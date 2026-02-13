# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from user.serializers.base import BaseResponseSerializer
from user.models import Project


class ProjectResponseSerializer(serializers.ModelSerializer):
    """Response serializer for project detail."""
    
    class Meta:
        model = Project
        fields = [
            'id',
            'project_name',
            'active',
            'description',
            'created_datetime',
            'updated_datetime'
        ]


class ProjectListResponseSerializer(BaseResponseSerializer):
    """Response serializer for project list."""
    
    id = serializers.UUIDField()
    project_name = serializers.CharField()
    active = serializers.BooleanField()
    description = serializers.CharField(allow_null=True)
    created_datetime = serializers.DateTimeField()
    updated_datetime = serializers.DateTimeField()


class ProjectUsersResponseSerializer(BaseResponseSerializer):
    """Response serializer for project with users."""
    
    id = serializers.UUIDField()
    project_name = serializers.CharField()
    active = serializers.BooleanField()


class ProjectAssignResultSerializer(BaseResponseSerializer):
    """Response serializer for user assignment results."""
    
    project_id = serializers.CharField()
    project_name = serializers.CharField()
    assigned = serializers.ListField(child=serializers.DictField())
    already_assigned = serializers.ListField(child=serializers.DictField())
    assigned_count = serializers.IntegerField()
    skipped_count = serializers.IntegerField()
