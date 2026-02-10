"""
Response serializers for Access.
Serializers should NOT contain database queries.
Data should be pre-computed by services.
"""
from rest_framework import serializers
from user.serializers.base import BaseResponseSerializer
from user.models import Access


class AccessResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer for access detail.
    
    Expected:
    - roles_count: pre-computed from service or annotated
    """
    roles_count = serializers.IntegerField(read_only=True, default=0)
    
    class Meta:
        model = Access
        fields = [
            'id',
            'access_name',
            'access_code',
            'description',
            'created_datetime',
            'updated_datetime',
            'roles_count'
        ]


class AccessListResponseSerializer(serializers.ModelSerializer):
    """
    Lightweight response serializer for access list.
    
    Expected:
    - roles_count: annotated on queryset
    """
    roles_count = serializers.IntegerField(read_only=True, default=0)
    
    class Meta:
        model = Access
        fields = [
            'id',
            'access_name',
            'access_code',
            'created_datetime',
            'roles_count'
        ]
