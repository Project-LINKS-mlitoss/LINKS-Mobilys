# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import serializers
from django.contrib.auth import get_user_model
from user.serializers.base import BaseResponseSerializer
from user.models import UserDetail

User = get_user_model()


class UserBasicResponseSerializer(BaseResponseSerializer):
    """Lightweight response serializer for user basic info."""
    
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_active = serializers.BooleanField()
    role_name = serializers.CharField(source='user_detail.role.role_name', allow_null=True, default=None)
    role_level = serializers.CharField(source='user_detail.role.level', allow_null=True, default=None)


class UserDetailInfoResponseSerializer(BaseResponseSerializer):
    """Response serializer for user_detail info."""
    
    id = serializers.UUIDField()
    role = serializers.SerializerMethodField()
    role_name = serializers.CharField(source='role.role_name', allow_null=True, default=None)
    role_level = serializers.CharField(source='role.level', allow_null=True, default=None)
    organization = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source='organization.organization_name', allow_null=True, default=None)
    created_by = serializers.CharField(source='created_by.username', allow_null=True, default=None)
    description = serializers.CharField(allow_null=True)
    created_date = serializers.DateTimeField()
    updated_datetime = serializers.DateTimeField()
    
    def get_role(self, obj):
        if obj.role:
            return str(obj.role.id)
        return None
    
    def get_organization(self, obj):
        if obj.organization:
            return str(obj.organization.id)
        return None


class UserResponseSerializer(serializers.ModelSerializer):
    """Full response serializer for user with user_detail."""
    
    user_detail = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_superuser',
            'is_staff',
            'is_active',
            'date_joined',
            'last_login',
            'user_detail'
        ]
    
    def get_user_detail(self, obj):
        """Safely get user_detail, returns None if doesn't exist."""
        try:
            user_detail = obj.user_detail
            return UserDetailInfoResponseSerializer(user_detail).data
        except:
            return None


class UserAccessesResponseSerializer(BaseResponseSerializer):
    """Response serializer for user's accesses."""
    
    id = serializers.CharField()
    access_name = serializers.CharField()
    access_code = serializers.CharField()
    description = serializers.CharField(allow_null=True)


class CurrentUserResponseSerializer(BaseResponseSerializer):
    """Response serializer for current user info endpoint."""
    
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_active = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    date_joined = serializers.DateTimeField()
    last_login = serializers.DateTimeField(allow_null=True)
    user_detail = serializers.DictField(allow_null=True)
    accesses = UserAccessesResponseSerializer(many=True)
