# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from user.serializers.base import BaseRequestSerializer


class CreateProjectRequestSerializer(BaseRequestSerializer):
    """Request serializer for creating a project."""
    
    project_name = serializers.CharField(
        max_length=200,
        help_text="Name of the project"
    )
    active = serializers.BooleanField(
        default=True,
        help_text="Whether project is active"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Project description"
    )
    
    def validate_project_name(self, value):
        """Validate that project_name is not blank."""
        if not value.strip():
            raise serializers.ValidationError("Project name cannot be empty")
        return value.strip()


class UpdateProjectRequestSerializer(BaseRequestSerializer):
    """Request serializer for updating a project. All fields optional."""
    
    project_name = serializers.CharField(
        max_length=200,
        required=False,
        help_text="Name of the project"
    )
    active = serializers.BooleanField(
        required=False,
        help_text="Whether project is active"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Project description"
    )
    
    def validate_project_name(self, value):
        """Validate that project_name is not blank if provided."""
        if value is not None and not value.strip():
            raise serializers.ValidationError("Project name cannot be empty")
        return value.strip() if value else value


class AssignUsersRequestSerializer(BaseRequestSerializer):
    """Request serializer for assigning users to a project."""
    
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="List of user IDs to assign"
    )


class ListProjectsRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing projects with filters."""
    
    active = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Filter by active status"
    )
    search = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="Search by project name"
    )


class AssignOrganizationUsersRequestSerializer(BaseRequestSerializer):
    """Request serializer for assigning all users from organization to project."""
    
    organization_id = serializers.UUIDField(
        help_text="UUID of the organization"
    )
