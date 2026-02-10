"""
Authentication service for handling login business logic.
"""
import logging
from typing import Optional, Dict, Any, List
from django.contrib.auth import get_user_model
from user.constants import RoleLevel

User = get_user_model()
logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication business logic."""
    
    @staticmethod
    def get_user_role_level(user) -> Optional[str]:
        """Get user's role level."""
        try:
            user_detail = user.user_detail
            if user_detail.role:
                return user_detail.role.level
        except:
            pass
        return None
    
    @staticmethod
    def get_user_projects(user) -> List:
        """Get all projects user is assigned to."""
        project_mappings = user.project_mappings.all()
        return [mapping.project for mapping in project_mappings]
    
    @staticmethod
    def get_active_projects(projects: List) -> List:
        """Filter only active projects."""
        return [p for p in projects if p.active]
    
    @staticmethod
    def format_projects_for_selection(projects: List) -> List[Dict]:
        """Format projects for frontend selection."""
        return [
            {
                'id': str(project.id),
                'name': project.project_name
            }
            for project in projects
        ]
    
    @staticmethod
    def find_project_in_list(projects: List, project_id: str):
        """Find a specific project in user's project list."""
        for project in projects:
            if str(project.id) == str(project_id):
                return project
        return None
    
    @staticmethod
    def check_organization_active(user) -> bool:
        """Check if user's organization is active."""
        try:
            user_detail = user.user_detail
            if user_detail.organization:
                return user_detail.organization.active
        except:
            pass
        return True  # Default to active if no org
    
    @staticmethod
    def get_user_info(user) -> Dict[str, Any]:
        """Get user info for login response."""
        user_info = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
        }
        
        try:
            user_detail = user.user_detail
            user_info['role'] = {
                'id': str(user_detail.role.id),
                'name': user_detail.role.role_name,
                'level': user_detail.role.level
            } if user_detail.role else None
            user_info['organization'] = {
                'id': str(user_detail.organization.id),
                'name': user_detail.organization.organization_name
            } if user_detail.organization else None
        except:
            pass
        
        return user_info
    
    @staticmethod
    def format_project_response(project) -> Dict[str, str]:
        """Format project for response."""
        return {
            'id': str(project.id),
            'name': project.project_name
        }
    
    @staticmethod
    def process_super_user_login(
        user,
        project_id: Optional[str],
        login_without_project: bool,
        user_projects: List,
        active_projects: List
    ) -> Dict[str, Any]:
        """
        Process login for super_user role.
        
        Returns dict with:
        - project: selected project info or None
        - requires_project_selection: True if user needs to select
        - available_projects: list of projects to choose from
        - allow_no_project: True for super_user
        - remove_tokens: True if tokens should not be returned yet
        """
        result = {
            'requires_project_selection': False,
            'remove_tokens': False
        }
        
        if login_without_project:
            result['project'] = None
            return result
        
        if project_id is None:
            if len(active_projects) > 1:
                # Multiple projects - return list for selection
                result['requires_project_selection'] = True
                result['available_projects'] = AuthService.format_projects_for_selection(active_projects)
                result['allow_no_project'] = True
                result['remove_tokens'] = True
                
            elif len(active_projects) == 1:
                # One project - give option to use it or skip
                result['requires_project_selection'] = True
                result['available_projects'] = AuthService.format_projects_for_selection(active_projects)
                result['allow_no_project'] = True
                result['remove_tokens'] = True
                
            else:
                # No projects - login without project
                result['project'] = None
        else:
            # project_id provided - verify and use it
            user_project = AuthService.find_project_in_list(user_projects, project_id)
            
            if not user_project:
                result['error'] = 'You are not assigned to this project.'
                return result
            
            if not user_project.active:
                result['error'] = 'Your project is not active.'
                return result
            
            result['project'] = AuthService.format_project_response(user_project)
        
        return result
    
    @staticmethod
    def process_regular_user_login(
        user,
        project_id: Optional[str],
        user_projects: List,
        active_projects: List
    ) -> Dict[str, Any]:
        """
        Process login for organizer/user roles.
        
        Returns dict with same structure as process_super_user_login.
        """
        result = {
            'requires_project_selection': False,
            'remove_tokens': False
        }
        
        # Check organization status
        if not AuthService.check_organization_active(user):
            result['error'] = 'Your organization is not active.'
            return result
        
        if project_id is None:
            # No project_id provided
            if not user_projects:
                result['error'] = 'You are not assigned to any project yet.'
                return result
            
            if len(active_projects) == 0:
                result['error'] = 'Your project is not active.'
                return result
            
            elif len(active_projects) == 1:
                # Only one active project, auto-select
                result['project'] = AuthService.format_project_response(active_projects[0])
                
            else:
                # Multiple projects - require selection
                result['requires_project_selection'] = True
                result['available_projects'] = AuthService.format_projects_for_selection(active_projects)
                result['remove_tokens'] = True
        else:
            # project_id provided
            user_project = AuthService.find_project_in_list(user_projects, project_id)
            
            if not user_project:
                result['error'] = 'You are not assigned to this project.'
                return result
            
            if not user_project.active:
                result['error'] = 'Your project is not active.'
                return result
            
            result['project'] = AuthService.format_project_response(user_project)
        
        return result
