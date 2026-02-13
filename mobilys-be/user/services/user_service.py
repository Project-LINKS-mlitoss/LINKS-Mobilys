# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Optional, List, Dict, Any
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db.models import Q

from user.models import ProjectUserMap, UserDetail, Role, Organization, RoleAccessMap
from user.services.base import (
    transactional,
    log_service_call,
    ValidationError,
    NotFoundError,
)
from user.constants import ErrorMessages, RoleLevel
from user.models import Project

User = get_user_model()
# Sentinel value to distinguish "not provided" from "explicitly null"
_UNSET = object()

class UserService:
    """
    Service class for User-related business operations.
    All methods are stateless and operate on provided parameters.
    """
    
    @staticmethod
    def get_by_id(user_id: int) -> User:
        """
        Retrieve user by ID.
        
        Args:
            user_id: The user primary key
            
        Returns:
            User instance
            
        Raises:
            NotFoundError: If user does not exist
        """
        try:
            return User.objects.select_related('user_detail', 'user_detail__role', 'user_detail__organization').get(pk=user_id)
        except User.DoesNotExist:
            raise NotFoundError(
                message=f"User with id {user_id} not found",
                code=ErrorMessages.USER_NOT_FOUND
            )
    
    @staticmethod
    def list_users(
        is_active: Optional[bool] = None,
        is_superuser: Optional[bool] = None,
        role_level: Optional[str] = None,
        organization_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[User]:
        """
        List users with optional filters.
        
        Args:
            is_active: Filter by active status
            is_superuser: Filter by superuser status
            role_level: Filter by role level
            organization_id: Filter by organization
            search: Search by username, email, first_name, or last_name
            
        Returns:
            List of User instances
        """
        queryset = User.objects.select_related(
            'user_detail', 'user_detail__role', 'user_detail__organization'
        ).order_by('-date_joined')
        
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active)
        
        if is_superuser is not None:
            queryset = queryset.filter(is_superuser=is_superuser)
        
        if role_level:
            queryset = queryset.filter(user_detail__role__level=role_level)
        
        if organization_id:
            queryset = queryset.filter(user_detail__organization_id=organization_id)
        
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        return list(queryset)
    
    @staticmethod
    @transactional
    @log_service_call
    def create_user(
        username: str,
        password: str,
        role_id: str,
        first_name: str = '',
        last_name: str = '',
        organization_id: Optional[str] = None,
        user_detail_description: str = '',
        created_by: Optional[User] = None
    ) -> User:
        """
        Create a new user with user_detail.
        
        Args:
            username: Username for the new user
            password: Password for the new user
            role_id: UUID of the role
            first_name: First name
            last_name: Last name
            organization_id: UUID of the organization (optional)
            user_detail_description: Description for user_detail
            created_by: User who created this user
            
        Returns:
            Created User instance
            
        Raises:
            ValidationError: If username already exists or role not found
        """
        # Validate username
        if User.objects.filter(username=username).exists():
            raise ValidationError(
                message="Username already exists",
                code=ErrorMessages.USERNAME_EXISTS
            )
        
        # Get role
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            raise NotFoundError(
                message="Role not found",
                code=ErrorMessages.ROLE_NOT_FOUND
            )
        
        # Get organization if provided
        organization = None
        if organization_id:
            try:
                organization = Organization.objects.get(pk=organization_id)
            except Organization.DoesNotExist:
                raise NotFoundError(
                    message="Organization not found",
                    code=ErrorMessages.ORGANIZATION_NOT_FOUND
                )
        
        # Determine is_superuser and is_staff based on role level
        is_superuser = role.level == RoleLevel.SUPER_USER.value
        is_staff = is_superuser
        
        # Create user
        user = User.objects.create(
            username=username,
            email=f"{username}@mobilys.com",
            password=make_password(password),
            first_name=first_name,
            last_name=last_name,
            is_superuser=is_superuser,
            is_staff=is_staff,
            is_active=True
        )
        
        # Create user_detail
        UserDetail.objects.create(
            user=user,
            role=role,
            organization=organization,
            created_by=created_by,
            description=user_detail_description
        )
        
        return user
    
    @staticmethod
    @transactional
    @log_service_call
    def update_user(
        user_id: int,
        username: Optional[str] = None,
        password: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        is_active: Optional[bool] = None,
        role_id: Optional[str] = None,
        organization_id = _UNSET, 
        user_detail_description: Optional[str] = None
    ) -> User:
        """
        Update an existing user.
        
        Returns:
            Updated User instance
            
        Raises:
            NotFoundError: If user not found
            ValidationError: If username already exists
        """
        user = UserService.get_by_id(user_id)
        
        # Validate username uniqueness if changing
        if username and username != user.username:
            if User.objects.filter(username=username).exclude(id=user_id).exists():
                raise ValidationError(
                    message="Username already exists",
                    code=ErrorMessages.USERNAME_EXISTS
                )
            user.username = username
            user.email = f"{username}@mobilys.com"
        
        if password:
            user.password = make_password(password)
        
        if first_name is not None:
            user.first_name = first_name
        
        if last_name is not None:
            user.last_name = last_name
        
        if is_active is not None:
            user.is_active = is_active
        
        # Update role if provided
        if role_id:
            try:
                role = Role.objects.get(pk=role_id)
                user.user_detail.role = role
                # Update is_superuser and is_staff based on new role
                user.is_superuser = role.level == RoleLevel.SUPER_USER.value
                user.is_staff = user.is_superuser
            except Role.DoesNotExist:
                raise NotFoundError(
                    message="Role not found",
                    code=ErrorMessages.ROLE_NOT_FOUND
                )
        
        # Update organization - check if explicitly provided (including None)
        if organization_id is not _UNSET:
            if organization_id is not None:
                try:
                    organization = Organization.objects.get(pk=organization_id)
                    user.user_detail.organization = organization
                except Organization.DoesNotExist:
                    raise NotFoundError(
                        message="Organization not found",
                        code=ErrorMessages.ORGANIZATION_NOT_FOUND
                    )
            else:
                user.user_detail.organization = None
        
        if user_detail_description is not None:
            user.user_detail.description = user_detail_description
        
        user.save()
        user.user_detail.save()
        
        return user
    
    @staticmethod
    @transactional
    @log_service_call
    def delete_user(user_id: int) -> str:
        """
        Delete a user.
        
        Args:
            user_id: The user ID to delete
            
        Returns:
            Username of deleted user
            
        Raises:
            NotFoundError: If user not found
        """
        user = UserService.get_by_id(user_id)
        username = user.username
        user.delete()
        return username
    
    @staticmethod
    @log_service_call
    def toggle_active(user_id: int) -> User:
        """
        Toggle user active status.
        
        Returns:
            Updated User instance
        """
        user = UserService.get_by_id(user_id)
        user.is_active = not user.is_active
        user.save()
        return user
    
    @staticmethod
    @log_service_call
    def change_password(user_id: int, new_password: str) -> User:
        """
        Change user password.
        
        Args:
            user_id: The user ID
            new_password: The new password
            
        Returns:
            Updated User instance
        """
        user = UserService.get_by_id(user_id)
        user.password = make_password(new_password)
        user.save()
        return user
    
    @staticmethod
    def get_user_accesses(user: User) -> List[Dict[str, Any]]:
        """
        Get accesses for a user based on their role.
        
        Args:
            user: The user instance
            
        Returns:
            List of access dictionaries
        """
        try:
            user_detail = user.user_detail
            if not user_detail.role:
                return []
            
            role_access_maps = RoleAccessMap.objects.filter(
                role=user_detail.role
            ).select_related('access')
            
            return [
                {
                    'id': str(ram.access.id),
                    'access_name': ram.access.access_name,
                    'access_code': ram.access.access_code,
                    'description': ram.access.description
                }
                for ram in role_access_maps
            ]
        except UserDetail.DoesNotExist:
            return []
    
    @staticmethod
    def get_current_user_info(user: User) -> Dict[str, Any]:
        """
        Get complete info for currently logged-in user.
        
        Args:
            user: The authenticated user
            
        Returns:
            Dictionary with user info, user_detail, and accesses
        """
        user_info = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
        }
        
        try:
            user_detail = user.user_detail
            user_info['user_detail'] = {
                'id': str(user_detail.id),
                'role': {
                    'id': str(user_detail.role.id),
                    'role_name': user_detail.role.role_name,
                    'level': user_detail.role.level
                } if user_detail.role else None,
                'organization': {
                    'id': str(user_detail.organization.id),
                    'organization_name': user_detail.organization.organization_name
                } if user_detail.organization else None,
                'description': user_detail.description,
                'created_date': user_detail.created_date
            }
        except UserDetail.DoesNotExist:
            user_info['user_detail'] = None
        
        user_info['accesses'] = UserService.get_user_accesses(user)
        
        return user_info

    @staticmethod
    def get_current_user_projects(user: User) -> List[Project]:
        """
        Get all projects assigned to the currently logged-in user.
        
        Args:
            user: The authenticated user
            
        Returns:
            List of project dictionaries
        """
        mappings = ProjectUserMap.objects.filter(user=user).select_related('project')
        projects = [mapping.project for mapping in mappings]
        
        return projects