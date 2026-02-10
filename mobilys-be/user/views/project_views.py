from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from mobilys_BE.shared.response import BaseResponse
from user.services import ProjectService, NotFoundError, ValidationError
from user.serializers.request import (
    CreateProjectRequestSerializer,
    UpdateProjectRequestSerializer,
    AssignUsersRequestSerializer,
    ListProjectsRequestSerializer,
    AssignOrganizationUsersRequestSerializer,
)
from user.serializers.response import (
    ProjectResponseSerializer,
    UserResponseSerializer,
)
import logging
from mobilys_BE.shared.log_json import log_json
from user.utils.errors import ErrorMessages

logger = logging.getLogger(__name__)


class ProjectViewSet(viewsets.ViewSet):
    """
    ViewSet for CRUD operations on Project.
    
    Views are thin - they handle HTTP concerns only.
    All business logic is delegated to ProjectService.
    """
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """
        Get all projects.
        Query params: active, search
        """
        request_serializer = ListProjectsRequestSerializer(data=request.query_params)

        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "project_list_validation_failed",
                request=request.query_params,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )

        validated_data = request_serializer.validated_data
        active = validated_data.get('active')
        search = validated_data.get('search')
        
        projects = ProjectService.list_projects(active=active, search=search)
        serializer = ProjectResponseSerializer(projects, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(projects)} project(s) retrieved"
        )
    
    def create(self, request):
        """Create new project."""
        request_serializer = CreateProjectRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "project_create_validation_failed",
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            project = ProjectService.create_project(**request_serializer.validated_data)
            response_serializer = ProjectResponseSerializer(project)
            
            return BaseResponse.created(
                data=response_serializer.data,
                message="Project created successfully"
            )
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "project_create_validation_error",
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    def retrieve(self, request, pk=None):
        """Get single project by ID."""
        try:
            project = ProjectService.get_by_id(pk)
            serializer = ProjectResponseSerializer(project)
            
            return BaseResponse.success(data=serializer.data)
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "project_retrieve_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    def update(self, request, pk=None):
        """Update project (full update - PUT)."""
        request_serializer = UpdateProjectRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "project_update_validation_failed",
                pk=pk,
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            project = ProjectService.update_project(pk, **request_serializer.validated_data)
            response_serializer = ProjectResponseSerializer(project)
            
            return BaseResponse.success(
                data=response_serializer.data,
                message="Project updated successfully"
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "project_update_not_found",
                pk=pk,
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "project_update_validation_error",
                pk=pk,
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    def partial_update(self, request, pk=None):
        """Partial update project (PATCH)."""
        return self.update(request, pk)
    
    def destroy(self, request, pk=None):
        """Delete project."""
        try:
            project_name = ProjectService.delete_project(pk)
            return BaseResponse.success(
                message=f'Project "{project_name}" deleted successfully'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "project_delete_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get only active projects. GET /api/projects/active/"""
        projects = ProjectService.list_projects(active=True)
        serializer = ProjectResponseSerializer(projects, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(projects)} active project(s) retrieved"
        )
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle active status. POST /api/projects/{id}/toggle_active/"""
        try:
            project = ProjectService.toggle_active(pk)
            serializer = ProjectResponseSerializer(project)
            
            return BaseResponse.success(
                data=serializer.data,
                message=f'Project is now {"active" if project.active else "inactive"}'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "project_toggle_active_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_users_to_project(request, project_id):
    """
    Assign user(s) to project.
    POST /api/projects/{project_id}/assign-users/
    """
    request_serializer = AssignUsersRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "project_assign_users_validation_failed",
            project_id=str(project_id),
            request=request.data,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )
    
    try:
        result = ProjectService.assign_users(
            str(project_id),
            request_serializer.validated_data['user_ids']
        )
        
        return BaseResponse.created(
            data=result,
            message=f"{result['assigned_count']} user(s) assigned to project"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_assign_users_not_found",
            project_id=str(project_id),
            request=request.data,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unassign_user_from_project(request, project_id, user_id):
    """
    Un-assign user from project.
    DELETE /api/projects/{project_id}/unassign-user/{user_id}/
    """
    try:
        result = ProjectService.unassign_user(str(project_id), user_id)
        
        return BaseResponse.success(
            message=f'User "{result["username"]}" un-assigned from project "{result["project_name"]}"'
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_unassign_user_not_found",
            project_id=str(project_id),
            user_id=user_id,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_unassign_users_from_project(request, project_id):
    """
    Bulk un-assign users from project.
    POST /api/projects/{project_id}/bulk-unassign-users/
    """
    request_serializer = AssignUsersRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "project_bulk_unassign_users_validation_failed",
            project_id=str(project_id),
            request=request.data,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )
    
    try:
        result = ProjectService.bulk_unassign_users(
            str(project_id),
            request_serializer.validated_data['user_ids']
        )
        
        return BaseResponse.success(
            data=result,
            message=f"{result['unassigned_count']} user(s) un-assigned from project"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_bulk_unassign_users_not_found",
            project_id=str(project_id),
            request=request.data,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_project_users(request, project_id):
    """
    Get all users assigned to a project.
    GET /api/projects/{project_id}/users/
    """
    try:
        result = ProjectService.get_project_users(str(project_id))
        serializer = UserResponseSerializer(result['users'], many=True)
        
        response = BaseResponse.success(message="Users retrieved successfully")
        response.data = {
            'success': True,
            'project': result['project'],
            'count': result['count'],
            'data': serializer.data
        }
        return response
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_users_not_found",
            project_id=str(project_id),
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def clear_project_users(request, project_id):
    """
    Remove all users from project.
    DELETE /api/projects/{project_id}/clear-users/
    """
    try:
        result = ProjectService.clear_project_users(str(project_id))
        
        return BaseResponse.success(
            data=result,
            message=f"All {result['removed_count']} user(s) removed from project"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_clear_users_not_found",
            project_id=str(project_id),
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_organization_users_to_project(request, project_id):
    """
    Assign all users from organization to project.
    POST /api/projects/{project_id}/assign-organization-users/
    """
    request_serializer = AssignOrganizationUsersRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "project_assign_org_users_validation_failed",
            project_id=str(project_id),
            request=request.data,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )
    
    try:
        result = ProjectService.assign_organization_users(
            str(project_id),
            str(request_serializer.validated_data['organization_id'])
        )
        
        return BaseResponse.created(
            data=result,
            message=f"{result['assigned_count']} user(s) from organization assigned to project"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_assign_org_users_not_found",
            project_id=str(project_id),
            request=request.data,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_organization_users_from_project(request, project_id):
    """
    Remove all users from specific organization from project.
    POST /api/projects/{project_id}/remove-organization-users/
    """
    request_serializer = AssignOrganizationUsersRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "project_remove_org_users_validation_failed",
            project_id=str(project_id),
            request=request.data,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )
    
    try:
        result = ProjectService.remove_organization_users(
            str(project_id),
            str(request_serializer.validated_data['organization_id'])
        )
        
        return BaseResponse.success(
            data=result,
            message=f"{result['removed_count']} user(s) from organization removed from project"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "project_remove_org_users_not_found",
            project_id=str(project_id),
            request=request.data,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)
