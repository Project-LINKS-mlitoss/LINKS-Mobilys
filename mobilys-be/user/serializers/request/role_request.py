# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from user.serializers.base import BaseRequestSerializer
from user.constants import RoleLevel


class CreateRoleRequestSerializer(BaseRequestSerializer):
    """Request serializer for creating a role."""
    
    role_name = serializers.CharField(
        max_length=100,
        help_text="Name of the role"
    )
    level = serializers.ChoiceField(
        choices=RoleLevel.choices(),
        help_text="Role level: super_user, organizer, or user"
    )
    active = serializers.BooleanField(
        default=True,
        help_text="Whether role is active"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Role description"
    )
    access_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
        help_text="List of access UUIDs to assign to this role"
    )
    
    def validate_role_name(self, value):
        """Validate that role_name is not blank."""
        if not value.strip():
            raise serializers.ValidationError("Role name cannot be empty")
        return value.strip()


class UpdateRoleRequestSerializer(BaseRequestSerializer):
    """Request serializer for updating a role. All fields optional."""
    
    role_name = serializers.CharField(
        max_length=100,
        required=False,
        help_text="Name of the role"
    )
    level = serializers.ChoiceField(
        choices=RoleLevel.choices(),
        required=False,
        help_text="Role level"
    )
    active = serializers.BooleanField(
        required=False,
        help_text="Whether role is active"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Role description"
    )
    access_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_null=True,
        help_text="List of access UUIDs to assign to this role"
    )


class ListRolesRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing roles with filters."""
    
    active = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Filter by active status"
    )
    level = serializers.ChoiceField(
        choices=RoleLevel.choices(),
        required=False,
        allow_null=True,
        help_text="Filter by role level"
    )
    search = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="Search by role name"
    )
