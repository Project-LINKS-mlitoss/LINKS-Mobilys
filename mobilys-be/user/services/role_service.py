# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Optional, List, Dict, Any
from django.contrib.auth import get_user_model
from django.db.models import Q, Count

from user.models import Role, RoleAccessMap, Access, UserDetail
from user.services.base import (
    transactional,
    log_service_call,
    ValidationError,
    NotFoundError,
)
from user.constants import ErrorMessages, RoleLevel

User = get_user_model()


class RoleService:
    """
    Service class for Role-related business operations.
    All methods are stateless and operate on provided parameters.
    """
    
    @staticmethod
    def get_by_id(role_id: str) -> Role:
        """
        Retrieve role by ID.
        
        Args:
            role_id: The role UUID
            
        Returns:
            Role instance
            
        Raises:
            NotFoundError: If role does not exist
        """
        try:
            return Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            raise NotFoundError(
                message="Role not found",
                code=ErrorMessages.ROLE_NOT_FOUND
            )
    
    @staticmethod
    def get_role_with_computed_fields(role: Role) -> Role:
        """
        Add computed fields to a role instance.
        
        Adds:
        - users_count: number of users with this role
        - accesses: list of access dicts
        """
        role.users_count = UserDetail.objects.filter(role=role).count()
        
        role_access_maps = RoleAccessMap.objects.filter(role=role).select_related('access')
        role.accesses = [
            {
                'id': str(ram.access.id),
                'access_name': ram.access.access_name,
                'access_code': ram.access.access_code,
                'description': ram.access.description
            }
            for ram in role_access_maps
        ]
        
        return role
    
    @staticmethod
    def list_roles(
        active: Optional[bool] = None,
        level: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Role]:
        """
        List roles with optional filters.
        Returns roles with users_count and accesses computed.
        
        Args:
            active: Filter by active status
            level: Filter by role level
            search: Search by role name
            
        Returns:
            List of Role instances with computed fields
        """
        queryset = Role.objects.all().order_by('-created_datetime')
        
        if active is not None:
            queryset = queryset.filter(active=active)
        
        if level:
            queryset = queryset.filter(level=level)
        
        if search:
            queryset = queryset.filter(role_name__icontains=search)
        
        # Annotate users_count
        queryset = queryset.annotate(users_count=Count('userdetail'))
        
        roles = list(queryset)
        
        # Add accesses to each role
        for role in roles:
            role_access_maps = RoleAccessMap.objects.filter(role=role).select_related('access')
            role.accesses = [
                {
                    'id': str(ram.access.id),
                    'access_name': ram.access.access_name,
                    'access_code': ram.access.access_code,
                    'description': ram.access.description
                }
                for ram in role_access_maps
            ]
        
        return roles
    
    @staticmethod
    @transactional
    @log_service_call
    def create_role(
        role_name: str,
        level: str,
        active: bool = True,
        description: str = '',
        access_ids: Optional[List[str]] = None
    ) -> Role:
        """
        Create a new role with optional access mappings.
        
        Args:
            role_name: Name of the role
            level: Role level (super_user, organizer, user)
            active: Whether role is active
            description: Role description
            access_ids: List of access UUIDs to assign
            
        Returns:
            Created Role instance
            
        Raises:
            ValidationError: If role name already exists or invalid level
        """
        if Role.objects.filter(role_name=role_name).exists():
            raise ValidationError(
                message="Role with this name already exists",
                code=ErrorMessages.ROLE_NAME_EXISTS
            )
        
        valid_levels = RoleLevel.values()
        if level not in valid_levels:
            raise ValidationError(
                message=f"Invalid level. Must be one of: {', '.join(valid_levels)}",
                code=ErrorMessages.VALIDATION_ERROR
            )
        
        # Validate access_ids if provided
        if access_ids:
            existing_ids = set(Access.objects.filter(id__in=access_ids).values_list('id', flat=True))
            provided_ids = set(access_ids)
            invalid_ids = provided_ids - {str(id) for id in existing_ids}
            if invalid_ids:
                raise ValidationError(
                    message=f"Invalid access IDs: {', '.join(invalid_ids)}",
                    code=ErrorMessages.ACCESS_NOT_FOUND
                )
        
        # Create role
        role = Role.objects.create(
            role_name=role_name,
            level=level,
            active=active,
            description=description
        )
        
        # Create role_access_map for each access_id
        if access_ids:
            role_access_maps = [
                RoleAccessMap(role=role, access_id=access_id)
                for access_id in access_ids
            ]
            RoleAccessMap.objects.bulk_create(role_access_maps)
        
        return role
    
    @staticmethod
    @transactional
    @log_service_call
    def update_role(
        role_id: str,
        role_name: Optional[str] = None,
        level: Optional[str] = None,
        active: Optional[bool] = None,
        description: Optional[str] = None,
        access_ids: Optional[List[str]] = None
    ) -> Role:
        """
        Update an existing role.
        
        Returns:
            Updated Role instance
        """
        role = RoleService.get_by_id(role_id)
        
        if role_name and role_name != role.role_name:
            if Role.objects.filter(role_name=role_name).exclude(id=role_id).exists():
                raise ValidationError(
                    message="Role with this name already exists",
                    code=ErrorMessages.ROLE_NAME_EXISTS
                )
            role.role_name = role_name
        
        if level:
            valid_levels = RoleLevel.values()
            if level not in valid_levels:
                raise ValidationError(
                    message=f"Invalid level. Must be one of: {', '.join(valid_levels)}",
                    code=ErrorMessages.VALIDATION_ERROR
                )
            role.level = level
        
        if active is not None:
            role.active = active
        
        if description is not None:
            role.description = description
        
        role.save()
        
        # Update role_access_map if access_ids provided
        if access_ids is not None:
            # Delete existing mappings
            RoleAccessMap.objects.filter(role=role).delete()
            
            # Create new mappings
            if access_ids:
                role_access_maps = [
                    RoleAccessMap(role=role, access_id=access_id)
                    for access_id in access_ids
                ]
                RoleAccessMap.objects.bulk_create(role_access_maps)
        
        return role
    
    @staticmethod
    @transactional
    @log_service_call
    def delete_role(role_id: str) -> str:
        """
        Delete a role.
        
        Returns:
            Name of deleted role
            
        Raises:
            ValidationError: If role has users assigned
        """
        role = RoleService.get_by_id(role_id)
        
        # Check if role has users
        users_count = UserDetail.objects.filter(role=role).count()
        if users_count > 0:
            raise ValidationError(
                message=f"Cannot delete role. {users_count} user(s) are assigned to this role.",
                code=ErrorMessages.ROLE_HAS_USERS
            )
        
        role_name = role.role_name
        role.delete()
        return role_name
    
    @staticmethod
    @log_service_call
    def toggle_active(role_id: str) -> Role:
        """Toggle role active status."""
        role = RoleService.get_by_id(role_id)
        role.active = not role.active
        role.save()
        return role
    
    @staticmethod
    def get_role_users(role_id: str) -> List[User]:
        """
        Get all users with a specific role.
        
        Returns:
            List of User instances
        """
        role = RoleService.get_by_id(role_id)
        
        user_details = UserDetail.objects.filter(role=role).select_related('user')
        return [ud.user for ud in user_details]
    
    @staticmethod
    def get_role_accesses(role_id: str) -> List[Access]:
        """
        Get all accesses for a role.
        
        Returns:
            List of Access instances
        """
        role = RoleService.get_by_id(role_id)
        
        role_access_maps = RoleAccessMap.objects.filter(role=role).select_related('access')
        return [ram.access for ram in role_access_maps]
    
    @staticmethod
    def get_level_choices() -> List[Dict[str, str]]:
        """Get available role level choices."""
        return [
            {'value': level.value, 'label': level.name.replace('_', ' ').title()}
            for level in RoleLevel
        ]
