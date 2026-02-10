"""
Response serializers for Organization.
Serializers should NOT contain database queries.
Data should be pre-computed by services.
"""
from rest_framework import serializers
from user.serializers.base import BaseResponseSerializer
from user.serializers.response.user_response import UserBasicResponseSerializer
from user.models import Organization


class OrganizationResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer for organization detail.
    
    Expected:
    - organization_users: pre-computed list from service
    """
    organizer_detail = UserBasicResponseSerializer(source='organizer', read_only=True)
    organization_users = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        default=list
    )
    
    class Meta:
        model = Organization
        fields = [
            'id',
            'organization_name',
            'organizer',
            'organizer_detail',
            'active',
            'description',
            'section',
            'created_datetime',
            'updated_datetime',
            'organization_users'
        ]


class OrganizationListResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer for organization list.
    
    Expected:
    - organization_users: pre-computed list from service
    """
    organizer_name = serializers.CharField(source='organizer.username', allow_null=True, default=None)
    organization_users = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        default=list
    )
    
    class Meta:
        model = Organization
        fields = [
            'id',
            'organization_name',
            'organizer_name',
            'active',
            'section',
            'description',
            'created_datetime',
            'organization_users'
        ]


class OrganizationToggleResultSerializer(BaseResponseSerializer):
    """Response serializer for organization toggle result."""
    
    organization_status = serializers.CharField()
    affected_users_count = serializers.IntegerField()
    affected_users = serializers.ListField(child=serializers.DictField())
    super_users_count = serializers.IntegerField()
    super_users = serializers.ListField(child=serializers.DictField())
