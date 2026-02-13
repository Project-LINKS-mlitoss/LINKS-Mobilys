# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Optional, List, Dict, Any
from django.contrib.auth import get_user_model
from django.db.models import Q

from user.models import Organization, UserDetail
from user.services.base import (
    transactional,
    log_service_call,
    ValidationError,
    NotFoundError,
)
from user.constants import ErrorMessages, RoleLevel

User = get_user_model()
_UNSET = object()

class OrganizationService:
    """
    Service class for Organization-related business operations.
    All methods are stateless and operate on provided parameters.
    """
    
    @staticmethod
    def get_by_id(organization_id: str) -> Organization:
        """
        Retrieve organization by ID.
        
        Args:
            organization_id: The organization UUID
            
        Returns:
            Organization instance
            
        Raises:
            NotFoundError: If organization does not exist
        """
        try:
            return Organization.objects.select_related('organizer').get(pk=organization_id)
        except Organization.DoesNotExist:
            raise NotFoundError(
                message="Organization not found",
                code=ErrorMessages.ORGANIZATION_NOT_FOUND
            )
    
    @staticmethod
    def get_organization_users_data(organization) -> List[Dict]:
        """
        Get formatted user data for an organization.
        
        Returns:
            List of user dicts suitable for serialization
        """
        user_details = UserDetail.objects.filter(organization=organization).select_related('user', 'role')
        return [
            {
                'id': ud.user.id,
                'username': ud.user.username,
                'email': ud.user.email,
                'first_name': ud.user.first_name,
                'last_name': ud.user.last_name,
                'is_active': ud.user.is_active,
                'role_name': ud.role.role_name if ud.role else None,
                'role_level': ud.role.level if ud.role else None,
            }
            for ud in user_details
        ]
    
    @staticmethod
    def get_organization_with_computed_fields(organization: Organization) -> Organization:
        """
        Add computed fields to an organization instance.
        
        Adds:
        - organization_users: list of user dicts
        """
        organization.organization_users = OrganizationService.get_organization_users_data(organization)
        return organization
    
    @staticmethod
    def list_organizations(
        active: Optional[bool] = None,
        search: Optional[str] = None,
        organizer_id: Optional[int] = None,
        section: Optional[str] = None
    ) -> List[Organization]:
        """
        List organizations with optional filters.
        Returns organizations with organization_users computed.
        
        Args:
            active: Filter by active status
            search: Search by organization name
            organizer_id: Filter by organizer user ID
            section: Filter by section
            
        Returns:
            List of Organization instances with computed fields
        """
        queryset = Organization.objects.select_related('organizer').order_by('-created_datetime')
        
        if active is not None:
            queryset = queryset.filter(active=active)
        
        if search:
            queryset = queryset.filter(organization_name__icontains=search)
        
        if organizer_id:
            queryset = queryset.filter(organizer_id=organizer_id)
        
        if section:
            queryset = queryset.filter(section__icontains=section)
        
        organizations = list(queryset)
        
        # Add organization_users to each organization
        for org in organizations:
            org.organization_users = OrganizationService.get_organization_users_data(org)
        
        return organizations
    
    @staticmethod
    @transactional
    @log_service_call
    def create_organization(
        organization_name: str,
        organizer_id: Optional[int] = None,
        active: bool = True,
        description: str = '',
        section: str = ''
    ) -> Organization:
        """
        Create a new organization.
        
        Args:
            organization_name: Name of the organization
            organizer_id: User ID of the organizer
            active: Whether organization is active
            description: Organization description
            section: Organization section
            
        Returns:
            Created Organization instance
            
        Raises:
            ValidationError: If organization name already exists
        """
        if Organization.objects.filter(organization_name=organization_name).exists():
            raise ValidationError(
                message="Organization with this name already exists",
                code=ErrorMessages.ORGANIZATION_NAME_EXISTS
            )
        
        organizer = None
        if organizer_id:
            try:
                organizer = User.objects.get(id=organizer_id)
            except User.DoesNotExist:
                raise NotFoundError(
                    message="Organizer user not found",
                    code=ErrorMessages.USER_NOT_FOUND
                )
        
        organization = Organization.objects.create(
            organization_name=organization_name,
            organizer=organizer,
            active=active,
            description=description,
            section=section
        )
        
        # Add organizer to organization members
        if organizer:
            try:
                user_detail = organizer.user_detail
                user_detail.organization = organization
                user_detail.save()
            except UserDetail.DoesNotExist:
                # Create user_detail if it doesn't exist
                UserDetail.objects.create(
                    user=organizer,
                    organization=organization
                )
        
        return organization
    


    @staticmethod
    @transactional
    @log_service_call
    def update_organization(
        organization_id: str,
        organization_name: Optional[str] = None,
        organizer_id = _UNSET,
        active: Optional[bool] = None,
        description: Optional[str] = None,
        section: Optional[str] = None
    ) -> Organization:
        """
        Update an existing organization.
        
        Returns:
            Updated Organization instance
        """
        organization = OrganizationService.get_by_id(organization_id)
        
        if organization_name and organization_name != organization.organization_name:
            if Organization.objects.filter(organization_name=organization_name).exclude(id=organization_id).exists():
                raise ValidationError(
                    message="Organization with this name already exists",
                    code=ErrorMessages.ORGANIZATION_NAME_EXISTS
                )
            organization.organization_name = organization_name
        
        # Track old organizer for membership update
        old_organizer = organization.organizer
        new_organizer = None
        
        # Check if organizer_id is explicitly provided (not the sentinel)
        if organizer_id is not _UNSET:
            if organizer_id is not None:
                try:
                    new_organizer = User.objects.get(id=organizer_id)
                    organization.organizer = new_organizer
                except User.DoesNotExist:
                    raise NotFoundError(
                        message="Organizer user not found",
                        code=ErrorMessages.USER_NOT_FOUND
                    )
            else:
                organization.organizer = None
        
        if active is not None:
            organization.active = active
        
        if description is not None:
            organization.description = description
        
        if section is not None:
            organization.section = section
        
        organization.save()
        
        # Handle organizer membership changes
        if organizer_id is not _UNSET:
            # Remove old organizer from organization if different from new
            if old_organizer and old_organizer != new_organizer:
                try:
                    old_user_detail = old_organizer.user_detail
                    if old_user_detail.organization == organization:
                        old_user_detail.organization = None
                        old_user_detail.save()
                except UserDetail.DoesNotExist:
                    pass
            
            # Add new organizer to organization
            if new_organizer:
                try:
                    user_detail = new_organizer.user_detail
                    user_detail.organization = organization
                    user_detail.save()
                except UserDetail.DoesNotExist:
                    UserDetail.objects.create(
                        user=new_organizer,
                        organization=organization
                    )
        
        return organization
    
    @staticmethod
    @transactional
    @log_service_call
    def delete_organization(organization_id: str) -> str:
        """
        Delete an organization.
        
        Returns:
            Name of deleted organization
        """
        organization = OrganizationService.get_by_id(organization_id)
        organization_name = organization.organization_name
        organization.delete()
        return organization_name
    
    @staticmethod
    @transactional
    @log_service_call
    def toggle_active(organization_id: str) -> Dict[str, Any]:
        """
        Toggle organization active status and update all non-super_user members.
        
        Returns:
            Dictionary with organization status and affected users
        """
        organization = OrganizationService.get_by_id(organization_id)
        
        new_active_status = not organization.active
        organization.active = new_active_status
        organization.save()
        
        # Get users to be affected (user and organizer only, not super_user)
        affected_user_details = UserDetail.objects.filter(
            organization=organization,
            role__level__in=[RoleLevel.USER.value, RoleLevel.ORGANIZER.value]
        ).select_related('user', 'role')
        
        affected_user_ids = [ud.user.id for ud in affected_user_details]
        
        # Get super_users (not affected)
        super_user_details = UserDetail.objects.filter(
            organization=organization,
            role__level=RoleLevel.SUPER_USER.value
        ).select_related('user', 'role')
        
        # Bulk update affected users
        affected_count = User.objects.filter(
            id__in=affected_user_ids
        ).update(is_active=new_active_status)
        
        # Prepare detailed response
        affected_users_info = [
            {
                'id': ud.user.id,
                'username': ud.user.username,
                'email': ud.user.email,
                'role_name': ud.role.role_name if ud.role else None,
                'role_level': ud.role.level if ud.role else None,
                'new_status': 'active' if new_active_status else 'inactive'
            }
            for ud in affected_user_details
        ]
        
        # Prepare super_user info (unchanged)
        super_users_info = [
            {
                'id': ud.user.id,
                'username': ud.user.username,
                'email': ud.user.email,
                'role_level': RoleLevel.SUPER_USER.value,
                'status': 'unchanged'
            }
            for ud in super_user_details
        ]
        
        return {
            'organization': organization,
            'organization_status': 'active' if new_active_status else 'inactive',
            'affected_users_count': affected_count,
            'affected_users': affected_users_info,
            'super_users_count': len(super_users_info),
            'super_users': super_users_info
        }
    
    @staticmethod
    @log_service_call
    def change_organizer(organization_id: str, new_organizer_id: int) -> Dict[str, str]:
        """
        Change the organizer of an organization.
        
        Returns:
            Dictionary with old and new organizer info
        """
        organization = OrganizationService.get_by_id(organization_id)
        
        try:
            new_organizer = User.objects.get(id=new_organizer_id)
        except User.DoesNotExist:
            raise NotFoundError(
                message="User not found",
                code=ErrorMessages.USER_NOT_FOUND
            )
        
        old_organizer_name = organization.organizer.username if organization.organizer else "None"
        organization.organizer = new_organizer
        organization.save()
        
        return {
            'old_organizer': old_organizer_name,
            'new_organizer': new_organizer.username,
            'organization': organization
        }
    
    @staticmethod
    def get_by_organizer(organizer_id: int) -> List[Organization]:
        """
        Get all organizations by organizer user ID.
        
        Returns:
            List of Organization instances
        """
        return list(Organization.objects.filter(organizer_id=organizer_id).order_by('-created_datetime'))
    
    @staticmethod
    def get_organization_users(organization_id: str) -> List[User]:
        """
        Get all users in an organization.
        
        Returns:
            List of User instances
        """
        organization = OrganizationService.get_by_id(organization_id)
        
        user_details = UserDetail.objects.filter(organization=organization).select_related(
            'user', 'role'
        )
        
        return [ud.user for ud in user_details]
