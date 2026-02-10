from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from mobilys_BE.shared.response import BaseResponse
from user.services import RoleService, NotFoundError, ValidationError
from user.serializers.request import (
    CreateRoleRequestSerializer,
    UpdateRoleRequestSerializer,
    ListRolesRequestSerializer,
)
from user.serializers.response import (
    RoleResponseSerializer,
    RoleListResponseSerializer,
)
import logging
from mobilys_BE.shared.log_json import log_json
from user.utils.errors import ErrorMessages
from user.utils.transform import stringify_list

logger = logging.getLogger(__name__)


class RoleViewSet(viewsets.ViewSet):
    """
    ViewSet for CRUD operations on Role.
    
    Views are thin - they handle HTTP concerns only.
    All business logic is delegated to RoleService.
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Use different serializer for list and detail."""
        if self.action == 'list':
            return RoleListResponseSerializer
        return RoleResponseSerializer
    
    def list(self, request):
        """
        Get all roles.
        Query params: active, level, search
        """
        request_serializer = ListRolesRequestSerializer(data=request.query_params)

        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "role_list_validation_failed",
                request=request.query_params,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )

        validated_data = request_serializer.validated_data
        active = validated_data.get('active')
        level = validated_data.get('level')
        search = validated_data.get('search')
        
        roles = RoleService.list_roles(active=active, level=level, search=search)
        serializer = RoleListResponseSerializer(roles, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(roles)} role(s) retrieved"
        )
    
    def create(self, request):
        """Create new role."""
        request_serializer = CreateRoleRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "role_create_validation_failed",
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            # Convert UUIDs to strings
            validated_data = request_serializer.validated_data.copy()
            if 'access_ids' in validated_data:
                validated_data['access_ids'] = stringify_list(validated_data['access_ids'])
            
            role = RoleService.create_role(**validated_data)
            role = RoleService.get_role_with_computed_fields(role)
            response_serializer = RoleResponseSerializer(role)
            
            return BaseResponse.created(
                data=response_serializer.data,
                message="Role created successfully"
            )
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_create_validation_error",
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_create_not_found",
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    def retrieve(self, request, pk=None):
        """Get single role by ID."""
        try:
            role = RoleService.get_by_id(pk)
            role = RoleService.get_role_with_computed_fields(role)
            serializer = RoleResponseSerializer(role)
            
            return BaseResponse.success(data=serializer.data)
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_retrieve_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    def update(self, request, pk=None):
        """Update role (full update - PUT)."""
        request_serializer = UpdateRoleRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "role_update_validation_failed",
                pk=pk,
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            # Convert UUIDs to strings
            validated_data = request_serializer.validated_data.copy()
            if 'access_ids' in validated_data and validated_data['access_ids']:
                validated_data['access_ids'] = stringify_list(validated_data['access_ids'])
            
            role = RoleService.update_role(pk, **validated_data)
            role = RoleService.get_role_with_computed_fields(role)
            response_serializer = RoleResponseSerializer(role)
            
            return BaseResponse.success(
                data=response_serializer.data,
                message="Role updated successfully"
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_update_not_found",
                pk=pk,
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_update_failed",
                pk=pk,
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    def partial_update(self, request, pk=None):
        """Partial update role (PATCH)."""
        return self.update(request, pk)
    
    def destroy(self, request, pk=None):
        """Delete role."""
        try:
            role_name = RoleService.delete_role(pk)
            return BaseResponse.success(
                message=f'Role "{role_name}" deleted successfully'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_delete_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_delete_failed",
                pk=pk,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get only active roles. GET /api/roles/active/"""
        roles = RoleService.list_roles(active=True)
        serializer = RoleListResponseSerializer(roles, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(roles)} active role(s) retrieved"
        )
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle active status. POST /api/roles/{id}/toggle_active/"""
        try:
            role = RoleService.toggle_active(pk)
            role = RoleService.get_role_with_computed_fields(role)
            serializer = RoleResponseSerializer(role)
            
            return BaseResponse.success(
                data=serializer.data,
                message=f'Role is now {"active" if role.active else "inactive"}'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_toggle_active_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get all users with this role. GET /api/roles/{id}/users/"""
        try:
            users = RoleService.get_role_users(pk)
            from user.serializers.response.user_response import UserResponseSerializer
            serializer = UserResponseSerializer(users, many=True)
            
            return BaseResponse.success(
                data=serializer.data,
                message=f"{len(users)} user(s) with this role"
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "role_users_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    @action(detail=False, methods=['get'])
    def level_choices(self, request):
        """Get available level choices. GET /api/roles/level_choices/"""
        choices = RoleService.get_level_choices()
        
        return BaseResponse.success(
            data=choices,
            message="Level choices retrieved"
        )
