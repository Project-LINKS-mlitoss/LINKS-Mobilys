# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Optional, List, Dict, Any
from django.contrib.auth import get_user_model
from django.db.models import Q

from user.models import Project, ProjectUserMap, UserDetail, Organization
from user.services.base import (
    transactional,
    log_service_call,
    ValidationError,
    NotFoundError,
)
from user.constants import ErrorMessages

User = get_user_model()


class ProjectService:
    """
    Service class for Project-related business operations.
    All methods are stateless and operate on provided parameters.
    """
    
    @staticmethod
    def get_by_id(project_id: str) -> Project:
        """
        Retrieve project by ID.
        
        Args:
            project_id: The project UUID
            
        Returns:
            Project instance
            
        Raises:
            NotFoundError: If project does not exist
        """
        try:
            return Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            raise NotFoundError(
                message=f"Project not found",
                code=ErrorMessages.PROJECT_NOT_FOUND
            )
    
    @staticmethod
    def list_projects(
        active: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[Project]:
        """
        List projects with optional filters.
        
        Args:
            active: Filter by active status
            search: Search by project name
            
        Returns:
            List of Project instances
        """
        queryset = Project.objects.all().order_by('-created_datetime')
        
        if active is not None:
            queryset = queryset.filter(active=active)
        
        if search:
            queryset = queryset.filter(project_name__icontains=search)
        
        return list(queryset)
    
    @staticmethod
    @transactional
    @log_service_call
    def create_project(
        project_name: str,
        active: bool = True,
        description: str = ''
    ) -> Project:
        """
        Create a new project.
        
        Args:
            project_name: Name of the project
            active: Whether project is active
            description: Project description
            
        Returns:
            Created Project instance
            
        Raises:
            ValidationError: If project name already exists
        """
        if Project.objects.filter(project_name=project_name).exists():
            raise ValidationError(
                message="Project with this name already exists",
                code=ErrorMessages.PROJECT_NAME_EXISTS
            )
        
        return Project.objects.create(
            project_name=project_name,
            active=active,
            description=description
        )
    
    @staticmethod
    @transactional
    @log_service_call
    def update_project(
        project_id: str,
        project_name: Optional[str] = None,
        active: Optional[bool] = None,
        description: Optional[str] = None
    ) -> Project:
        """
        Update an existing project.
        
        Returns:
            Updated Project instance
        """
        project = ProjectService.get_by_id(project_id)
        
        if project_name and project_name != project.project_name:
            if Project.objects.filter(project_name=project_name).exclude(id=project_id).exists():
                raise ValidationError(
                    message="Project with this name already exists",
                    code=ErrorMessages.PROJECT_NAME_EXISTS
                )
            project.project_name = project_name
        
        if active is not None:
            project.active = active
        
        if description is not None:
            project.description = description
        
        project.save()
        return project
    
    @staticmethod
    @transactional
    @log_service_call
    def delete_project(project_id: str) -> str:
        """
        Delete a project.
        
        Returns:
            Name of deleted project
        """
        project = ProjectService.get_by_id(project_id)
        project_name = project.project_name
        project.delete()
        return project_name
    
    @staticmethod
    @log_service_call
    def toggle_active(project_id: str) -> Project:
        """Toggle project active status."""
        project = ProjectService.get_by_id(project_id)
        project.active = not project.active
        project.save()
        return project
    
    @staticmethod
    @transactional
    @log_service_call
    def assign_users(project_id: str, user_ids: List[int]) -> Dict[str, Any]:
        """
        Assign users to a project.
        
        Args:
            project_id: The project UUID
            user_ids: List of user IDs to assign
            
        Returns:
            Dictionary with assigned and already_assigned lists
        """
        project = ProjectService.get_by_id(project_id)
        
        assigned = []
        already_assigned = []
        
        for user_id in user_ids:
            try:
                user = User.objects.get(id=user_id)
                
                if ProjectUserMap.objects.filter(project=project, user=user).exists():
                    already_assigned.append({
                        'user_id': user.id,
                        'username': user.username
                    })
                else:
                    ProjectUserMap.objects.create(project=project, user=user)
                    assigned.append({
                        'user_id': user.id,
                        'username': user.username
                    })
            except User.DoesNotExist:
                continue
        
        return {
            'project_id': str(project.id),
            'project_name': project.project_name,
            'assigned': assigned,
            'already_assigned': already_assigned,
            'assigned_count': len(assigned),
            'skipped_count': len(already_assigned)
        }
    
    @staticmethod
    @transactional
    @log_service_call
    def unassign_user(project_id: str, user_id: int) -> Dict[str, str]:
        """
        Unassign a single user from a project.
        
        Returns:
            Dictionary with username and project_name
        """
        project = ProjectService.get_by_id(project_id)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise NotFoundError(
                message="User not found",
                code=ErrorMessages.USER_NOT_FOUND
            )
        
        try:
            mapping = ProjectUserMap.objects.get(project=project, user=user)
            mapping.delete()
            return {
                'username': user.username,
                'project_name': project.project_name
            }
        except ProjectUserMap.DoesNotExist:
            raise NotFoundError(
                message=f"User is not assigned to this project",
                code=ErrorMessages.USER_NOT_ASSIGNED
            )
    
    @staticmethod
    @transactional
    @log_service_call
    def bulk_unassign_users(project_id: str, user_ids: List[int]) -> Dict[str, Any]:
        """
        Bulk unassign users from a project.
        
        Returns:
            Dictionary with unassigned count
        """
        project = ProjectService.get_by_id(project_id)
        
        deleted_count = ProjectUserMap.objects.filter(
            project=project,
            user_id__in=user_ids
        ).delete()[0]
        
        return {
            'project_id': str(project.id),
            'project_name': project.project_name,
            'unassigned_count': deleted_count
        }
    
    @staticmethod
    def get_project_users(project_id: str) -> Dict[str, Any]:
        """
        Get all users assigned to a project.
        
        Returns:
            Dictionary with project info and users list
        """
        project = ProjectService.get_by_id(project_id)
        
        mappings = ProjectUserMap.objects.filter(project=project).select_related(
            'user', 'user__user_detail', 'user__user_detail__role', 'user__user_detail__organization'
        )
        users = [mapping.user for mapping in mappings]
        
        return {
            'project': {
                'id': str(project.id),
                'project_name': project.project_name,
                'active': project.active
            },
            'count': len(users),
            'users': users
        }
    
    @staticmethod
    def get_user_projects(user_id: int) -> Dict[str, Any]:
        """
        Get all projects assigned to a user.
        
        Returns:
            Dictionary with user info and projects list
        """
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise NotFoundError(
                message="User not found",
                code=ErrorMessages.USER_NOT_FOUND
            )
        
        mappings = ProjectUserMap.objects.filter(user=user).select_related('project')
        projects = [mapping.project for mapping in mappings]
        
        return {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            },
            'count': len(projects),
            'projects': projects
        }
    
    @staticmethod
    @transactional
    @log_service_call
    def clear_project_users(project_id: str) -> Dict[str, Any]:
        """
        Remove all users from a project.
        
        Returns:
            Dictionary with removed count
        """
        project = ProjectService.get_by_id(project_id)
        
        deleted_count = ProjectUserMap.objects.filter(project=project).delete()[0]
        
        return {
            'project_id': str(project.id),
            'project_name': project.project_name,
            'removed_count': deleted_count
        }
    
    @staticmethod
    @transactional
    @log_service_call
    def assign_organization_users(project_id: str, organization_id: str) -> Dict[str, Any]:
        """
        Assign all users from an organization to a project.
        
        Returns:
            Dictionary with assignment results
        """
        project = ProjectService.get_by_id(project_id)
        
        try:
            organization = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            raise NotFoundError(
                message="Organization not found",
                code=ErrorMessages.ORGANIZATION_NOT_FOUND
            )
        
        # Get all users in the organization
        user_details = UserDetail.objects.filter(organization=organization).select_related('user')

        if user_details.count() == 0:
            raise NotFoundError(
                message="No users found in the specified organization",
                code=ErrorMessages.NO_USERS_IN_ORGANIZATION
            )
        
        assigned = []
        already_assigned = []
        
        for user_detail in user_details:
            user = user_detail.user
            if ProjectUserMap.objects.filter(project=project, user=user).exists():
                already_assigned.append({
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email
                })
            else:
                ProjectUserMap.objects.create(project=project, user=user)
                assigned.append({
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email
                })
        
        return {
            'project_id': str(project.id),
            'project_name': project.project_name,
            'organization_id': str(organization.id),
            'organization_name': organization.organization_name,
            'assigned': assigned,
            'already_assigned': already_assigned,
            'assigned_count': len(assigned),
            'skipped_count': len(already_assigned)
        }
    
    @staticmethod
    @transactional
    @log_service_call
    def remove_organization_users(project_id: str, organization_id: str) -> Dict[str, Any]:
        """
        Remove all users from an organization from a project.
        
        Returns:
            Dictionary with removal results
        """
        project = ProjectService.get_by_id(project_id)
        
        try:
            organization = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            raise NotFoundError(
                message="Organization not found",
                code=ErrorMessages.ORGANIZATION_NOT_FOUND
            )
        
        # Get all users in the organization
        user_details = UserDetail.objects.filter(organization=organization).select_related('user')
        user_ids = [ud.user.id for ud in user_details]
        
        # Get removed users info before deleting
        removed_mappings = ProjectUserMap.objects.filter(
            project=project,
            user_id__in=user_ids
        ).select_related('user')
        
        removed_users = [
            {
                'user_id': mapping.user.id,
                'username': mapping.user.username,
                'email': mapping.user.email
            }
            for mapping in removed_mappings
        ]
        
        # Delete mappings
        deleted_count = removed_mappings.delete()[0]
        
        return {
            'project_id': str(project.id),
            'project_name': project.project_name,
            'organization_id': str(organization.id),
            'organization_name': organization.organization_name,
            'removed': removed_users,
            'removed_count': deleted_count
        }
