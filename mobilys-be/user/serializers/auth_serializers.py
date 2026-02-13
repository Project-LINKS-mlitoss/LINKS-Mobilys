# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Authentication serializers.
Business logic has been moved to user/services/auth_service.py
"""
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model
from user.services.auth_service import AuthService
from user.constants import RoleLevel

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer for JWT authentication.
    Handles project selection logic for different user roles.
    """
    project_id = serializers.UUIDField(required=False, allow_null=True)
    login_without_project = serializers.BooleanField(required=False, default=False)
    
    def validate(self, attrs):
        # Call parent validate to check username/password
        data = super().validate(attrs)
        
        user = self.user
        project_id = attrs.get('project_id', None)
        login_without_project = attrs.get('login_without_project', False)
        
        # Get user data using service
        user_role_level = AuthService.get_user_role_level(user)
        user_projects = AuthService.get_user_projects(user)
        active_projects = AuthService.get_active_projects(user_projects)
        
        # Process login based on role
        if user_role_level == RoleLevel.SUPER_USER.value:
            result = AuthService.process_super_user_login(
                user=user,
                project_id=str(project_id) if project_id else None,
                login_without_project=login_without_project,
                user_projects=user_projects,
                active_projects=active_projects
            )
        else:
            result = AuthService.process_regular_user_login(
                user=user,
                project_id=str(project_id) if project_id else None,
                user_projects=user_projects,
                active_projects=active_projects
            )
        
        # Handle errors from service
        if 'error' in result:
            raise serializers.ValidationError({'detail': result['error']})
        
        # Apply result to response data
        if result.get('requires_project_selection'):
            data['requires_project_selection'] = True
            data['available_projects'] = result.get('available_projects', [])
            if result.get('allow_no_project'):
                data['allow_no_project'] = True
        
        if result.get('remove_tokens'):
            data.pop('access', None)
            data.pop('refresh', None)
        
        if 'project' in result:
            data['project'] = result['project']
        
        # Add user info
        data['user'] = AuthService.get_user_info(user)
        
        return data


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """Custom token refresh serializer."""
    pass