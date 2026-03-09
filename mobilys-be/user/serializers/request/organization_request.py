# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from user.serializers.base import BaseRequestSerializer


class CreateOrganizationRequestSerializer(BaseRequestSerializer):
    """Request serializer for creating an organization."""
    
    organization_name = serializers.CharField(
        max_length=200,
        help_text="Name of the organization"
    )
    organizer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="User ID of the organizer"
    )
    active = serializers.BooleanField(
        default=True,
        help_text="Whether organization is active"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Organization description"
    )
    section = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        default='',
        help_text="Organization section"
    )
    
    def validate_organization_name(self, value):
        """Validate that organization_name is not blank."""
        if not value.strip():
            raise serializers.ValidationError("Organization name cannot be empty")
        return value.strip()


class UpdateOrganizationRequestSerializer(BaseRequestSerializer):
    """Request serializer for updating an organization. All fields optional."""
    
    organization_name = serializers.CharField(
        max_length=200,
        required=False,
        help_text="Name of the organization"
    )
    organizer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="User ID of the organizer"
    )
    active = serializers.BooleanField(
        required=False,
        help_text="Whether organization is active"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Organization description"
    )
    section = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Organization section"
    )


class ChangeOrganizerRequestSerializer(BaseRequestSerializer):
    """Request serializer for changing organization's organizer."""
    
    organizer_id = serializers.IntegerField(
        help_text="User ID of the new organizer"
    )


class ListOrganizationsRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing organizations with filters."""
    
    active = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Filter by active status"
    )
    search = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="Search by organization name"
    )
    organizer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Filter by organizer user ID"
    )
    section = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text="Filter by section"
    )


class ListOrganizationsByOrganizerRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing organizations by organizer."""
    
    user_id = serializers.IntegerField(
        help_text="Organizer user ID"
    )
