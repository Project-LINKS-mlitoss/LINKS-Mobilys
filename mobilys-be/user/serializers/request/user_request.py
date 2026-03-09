# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from user.serializers.base import BaseRequestSerializer
from user.models import Role, Organization
from user.constants import RoleLevel


class CreateUserRequestSerializer(BaseRequestSerializer):
    """Request serializer for creating a user."""
    
    username = serializers.CharField(
        max_length=150,
        min_length=3,
        help_text="Username for the new user"
    )
    password = serializers.CharField(
        min_length=8,
        write_only=True,
        help_text="Password for the new user"
    )
    first_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default='',
        help_text="First name"
    )
    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default='',
        help_text="Last name"
    )
    role_id = serializers.UUIDField(
        help_text="UUID of the role"
    )
    organization_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of the organization (optional)"
    )
    user_detail_description = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Description for user_detail"
    )
    
    def validate_username(self, value):
        """Validate that username is not blank."""
        if not value.strip():
            raise serializers.ValidationError("Username cannot be blank")
        return value.strip()


class UpdateUserRequestSerializer(BaseRequestSerializer):
    """Request serializer for updating a user. All fields optional."""
    
    username = serializers.CharField(
        max_length=150,
        min_length=3,
        required=False,
        help_text="Username"
    )
    password = serializers.CharField(
        min_length=8,
        required=False,
        allow_blank=True,
        help_text="Leave blank to keep current password"
    )
    first_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        help_text="First name"
    )
    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        help_text="Last name"
    )
    is_active = serializers.BooleanField(
        required=False,
        help_text="Whether user is active"
    )
    role_id = serializers.UUIDField(
        required=False,
        help_text="UUID of the role"
    )
    organization_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of the organization"
    )
    user_detail_description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Description for user_detail"
    )


class ChangePasswordRequestSerializer(BaseRequestSerializer):
    """Request serializer for changing password."""
    
    new_password = serializers.CharField(
        min_length=8,
        help_text="New password"
    )


class ListUsersRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing users with filters."""
    
    is_active = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Filter by active status"
    )
    is_superuser = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Filter by superuser status"
    )
    role_level = serializers.ChoiceField(
        choices=RoleLevel.choices(),
        required=False,
        allow_null=True,
        help_text="Filter by role level"
    )
    organization_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Filter by organization"
    )
    search = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="Search by username, email, first_name, or last_name"
    )
