from rest_framework import serializers
from user.serializers.base import BaseRequestSerializer


class CreateAccessRequestSerializer(BaseRequestSerializer):
    """Request serializer for creating an access."""
    
    access_name = serializers.CharField(
        max_length=100,
        help_text="Name of the access"
    )
    access_code = serializers.CharField(
        max_length=100,
        help_text="Unique code for the access"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Access description"
    )
    
    def validate_access_name(self, value):
        """Validate that access_name is not blank."""
        if not value.strip():
            raise serializers.ValidationError("Access name cannot be empty")
        return value.strip()
    
    def validate_access_code(self, value):
        """Validate that access_code is not blank."""
        if not value.strip():
            raise serializers.ValidationError("Access code cannot be empty")
        return value.strip()


class UpdateAccessRequestSerializer(BaseRequestSerializer):
    """Request serializer for updating an access. All fields optional."""
    
    access_name = serializers.CharField(
        max_length=100,
        required=False,
        help_text="Name of the access"
    )
    access_code = serializers.CharField(
        max_length=100,
        required=False,
        help_text="Unique code for the access"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Access description"
    )


class ListAccessesRequestSerializer(BaseRequestSerializer):
    """Request serializer for listing accesses with search."""
    
    search = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="Search by access_name or access_code"
    )
