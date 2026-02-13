# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Optional, List
from django.db.models import Q, Count

from user.models import Access, RoleAccessMap, Role
from user.services.base import (
    transactional,
    log_service_call,
    ValidationError,
    NotFoundError,
)
from user.constants import ErrorMessages

class AccessService:
    """
    Service class for Access-related business operations.
    All methods are stateless and operate on provided parameters.
    """
    
    @staticmethod
    def get_by_id(access_id: str) -> Access:
        """
        Retrieve access by ID.
        
        Args:
            access_id: The access UUID
            
        Returns:
            Access instance
            
        Raises:
            NotFoundError: If access does not exist
        """
        try:
            return Access.objects.get(pk=access_id)
        except Access.DoesNotExist:
            raise NotFoundError(
                message="Access not found",
                code=ErrorMessages.ACCESS_NOT_FOUND
            )
    
    @staticmethod
    def get_access_with_computed_fields(access: Access) -> Access:
        """
        Add computed fields to an access instance.
        
        Adds:
        - roles_count: number of roles using this access
        """
        access.roles_count = RoleAccessMap.objects.filter(access=access).count()
        return access
    
    @staticmethod
    def list_accesses(search: Optional[str] = None) -> List[Access]:
        """
        List accesses with optional search.
        Returns accesses with roles_count computed.
        
        Args:
            search: Search by access_name or access_code
            
        Returns:
            List of Access instances with computed fields
        """
        queryset = Access.objects.all().order_by('-created_datetime')
        
        if search:
            queryset = queryset.filter(
                Q(access_name__icontains=search) |
                Q(access_code__icontains=search)
            )
        
        # Annotate roles_count
        queryset = queryset.annotate(roles_count=Count('role_mappings'))
        
        return list(queryset)
    
    @staticmethod
    @transactional
    @log_service_call
    def create_access(
        access_name: str,
        access_code: str,
        description: str = ''
    ) -> Access:
        """
        Create a new access.
        
        Args:
            access_name: Name of the access
            access_code: Unique code for the access
            description: Access description
            
        Returns:
            Created Access instance
            
        Raises:
            ValidationError: If access code already exists
        """
        if Access.objects.filter(access_code=access_code).exists():
            raise ValidationError(
                message="Access code already exists",
                code=ErrorMessages.ACCESS_CODE_EXISTS
            )
        
        return Access.objects.create(
            access_name=access_name,
            access_code=access_code,
            description=description
        )
    
    @staticmethod
    @transactional
    @log_service_call
    def update_access(
        access_id: str,
        access_name: Optional[str] = None,
        access_code: Optional[str] = None,
        description: Optional[str] = None
    ) -> Access:
        """
        Update an existing access.
        
        Returns:
            Updated Access instance
        """
        access = AccessService.get_by_id(access_id)
        
        if access_name:
            access.access_name = access_name
        
        if access_code and access_code != access.access_code:
            if Access.objects.filter(access_code=access_code).exclude(id=access_id).exists():
                raise ValidationError(
                    message="Access code already exists",
                    code=ErrorMessages.ACCESS_CODE_EXISTS
                )
            access.access_code = access_code
        
        if description is not None:
            access.description = description
        
        access.save()
        return access
    
    @staticmethod
    @transactional
    @log_service_call
    def delete_access(access_id: str) -> str:
        """
        Delete an access.
        
        Returns:
            Name of deleted access
        """
        access = AccessService.get_by_id(access_id)
        access_name = access.access_name
        access.delete()
        return access_name
    
    @staticmethod
    def get_access_roles(access_id: str) -> List[Role]:
        """
        Get all roles that have a specific access.
        
        Returns:
            List of Role instances
        """
        access = AccessService.get_by_id(access_id)
        
        role_access_maps = RoleAccessMap.objects.filter(access=access).select_related('role')
        return [ram.role for ram in role_access_maps]
    
    @staticmethod
    def get_roles_count(access_id: str) -> int:
        """Get the count of roles using this access."""
        return RoleAccessMap.objects.filter(access_id=access_id).count()
