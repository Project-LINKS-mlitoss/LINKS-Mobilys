# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Response serializers for Role.
Serializers should NOT contain database queries.
Data should be pre-computed by services and passed via context.
"""
from rest_framework import serializers
from user.serializers.base import BaseResponseSerializer
from user.models import Role


class AccessBasicResponseSerializer(BaseResponseSerializer):
    """Lightweight response serializer for access info."""
    
    id = serializers.UUIDField()
    access_name = serializers.CharField()
    access_code = serializers.CharField()
    description = serializers.CharField(allow_null=True)


class RoleResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer for role detail.
    
    Expected context:
    - users_count: pre-computed from service
    - accesses: pre-computed list of access dicts from service
    """
    users_count = serializers.IntegerField(read_only=True)
    accesses = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        default=list
    )
    
    class Meta:
        model = Role
        fields = [
            'id',
            'role_name',
            'level',
            'active',
            'description',
            'created_datetime',
            'updated_datetime',
            'users_count',
            'accesses'
        ]


class RoleListResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer for role list.
    
    Expected annotations on queryset:
    - users_count: annotated count
    - accesses: passed via context or as attribute
    """
    users_count = serializers.IntegerField(read_only=True)
    accesses = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        default=list
    )
    
    class Meta:
        model = Role
        fields = [
            'id',
            'role_name',
            'level',
            'active',
            'created_datetime',
            'users_count',
            'accesses'
        ]
