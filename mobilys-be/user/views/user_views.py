from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from mobilys_BE.shared.response import BaseResponse
from user.services import UserService, ProjectService, NotFoundError, ValidationError
from user.serializers.request import (
    CreateUserRequestSerializer,
    UpdateUserRequestSerializer,
    ChangePasswordRequestSerializer,
    ListUsersRequestSerializer,
)
from user.serializers.response import (
    UserResponseSerializer,
    ProjectResponseSerializer,
)
import logging
from mobilys_BE.shared.log_json import log_json
from user.utils.errors import ErrorMessages
from user.utils.transform import apply_explicit_nullable_field, stringify

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    """
    Create new user with user_detail.
    POST /api/users/create/
    """
    request_serializer = CreateUserRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "user_create_validation_failed",
            request=request.data,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )
    
    try:
        # Get created_by from authenticated user
        created_by = request.user if request.user.is_authenticated else None
        
        # Convert UUID to string
        validated_data = request_serializer.validated_data.copy()
        validated_data['role_id'] = stringify(validated_data['role_id'])
        if validated_data.get('organization_id'):
            validated_data['organization_id'] = stringify(validated_data['organization_id'])
        validated_data['created_by'] = created_by
        
        user = UserService.create_user(**validated_data)
        response_serializer = UserResponseSerializer(user)
        
        return BaseResponse.created(
            data=response_serializer.data,
            message="User created successfully"
        )
    except ValidationError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_create_failed",
            request=request.data,
            error=e.details
        )
        return BaseResponse.bad_request(message=e.message, error=e.details)
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_create_not_found",
            request=request.data,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_detail(request, user_id):
    """
    Get user detail by user ID.
    GET /api/users/{user_id}/
    """
    try:
        user = UserService.get_by_id(user_id)
        serializer = UserResponseSerializer(user)
        
        return BaseResponse.success(data=serializer.data)
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_retrieve_not_found",
            user_id=user_id,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_users(request):
    """
    List all users.
    GET /api/users/
    
    Query params:
    - is_active: filter by active status (true/false)
    - is_superuser: filter by superuser status (true/false)
    - role_level: filter by role level (super_user/organizer/user)
    - organization_id: filter by organization
    - search: search by username, email, first_name, or last_name
    """
    request_serializer = ListUsersRequestSerializer(data=request.query_params)

    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "user_list_validation_failed",
            request=request.query_params,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )

    validated_data = request_serializer.validated_data

    users = UserService.list_users(
        is_active=validated_data.get('is_active'),
        is_superuser=validated_data.get('is_superuser'),
        role_level=validated_data.get('role_level'),
        organization_id=validated_data.get('organization_id'),
        search=validated_data.get('search')
    )
    serializer = UserResponseSerializer(users, many=True)
    
    return BaseResponse.success(
        data=serializer.data,
        message=f"{len(users)} user(s) retrieved"
    )


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_user(request, user_id):
    """
    Update user.
    PUT/PATCH /api/users/{user_id}/update/
    """
    request_serializer = UpdateUserRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "user_update_validation_failed",
            user_id=user_id,
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
        if validated_data.get('role_id'):
            validated_data['role_id'] = stringify(validated_data['role_id'])
        
        # Handle organization_id - check raw request.data to detect explicit null
        # DRF might not include null values in validated_data when required=False
        apply_explicit_nullable_field(
            validated_data,
            request.data,
            "organization_id",
            caster=stringify,
        )
        
        user = UserService.update_user(user_id, **validated_data)
        response_serializer = UserResponseSerializer(user)
        
        return BaseResponse.success(
            data=response_serializer.data,
            message="User updated successfully"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_update_not_found",
            user_id=user_id,
            request=request.data,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)
    except ValidationError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_update_failed",
            user_id=user_id,
            request=request.data,
            error=e.details
        )
        return BaseResponse.bad_request(message=e.message, error=e.details)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    """
    Delete user.
    DELETE /api/users/{user_id}/delete/
    """
    try:
        username = UserService.delete_user(user_id)
        return BaseResponse.success(
            message=f'User "{username}" deleted successfully'
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_delete_not_found",
            user_id=user_id,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_user_active(request, user_id):
    """
    Toggle user active status.
    POST /api/users/{user_id}/toggle-active/
    """
    try:
        user = UserService.toggle_active(user_id)
        serializer = UserResponseSerializer(user)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f'User is now {"active" if user.is_active else "inactive"}'
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_toggle_active_not_found",
            user_id=user_id,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_user_password(request, user_id):
    """
    Change user password.
    POST /api/users/{user_id}/change-password/
    """
    request_serializer = ChangePasswordRequestSerializer(data=request.data)
    
    if not request_serializer.is_valid():
        log_json(
            logger,
            logging.ERROR,
            "user_change_password_validation_failed",
            user_id=user_id,
            request=request.data,
            error=request_serializer.errors
        )
        return BaseResponse.bad_request(
            message=ErrorMessages.VALIDATION_ERROR,
            error=request_serializer.errors
        )
    
    try:
        user = UserService.change_password(
            user_id,
            request_serializer.validated_data['new_password']
        )
        serializer = UserResponseSerializer(user)
        
        return BaseResponse.success(
            data=serializer.data,
            message="Password changed successfully"
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_change_password_not_found",
            user_id=user_id,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_projects(request, user_id):
    """
    Get all projects assigned to a user.
    GET /api/users/{user_id}/projects/
    """
    try:
        result = ProjectService.get_user_projects(user_id)
        serializer = ProjectResponseSerializer(result['projects'], many=True)
        
        return BaseResponse.success(
            data={
                'user': result['user'],
                'count': result['count'],
                'projects': serializer.data
            }
        )
    except NotFoundError as e:
        log_json(
            logger,
            logging.ERROR,
            "user_projects_not_found",
            user_id=user_id,
            error=e.message
        )
        return BaseResponse.not_found(message=e.message)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user_info(request):
    """
    Get complete info for currently logged-in user.
    GET /api/users/me/
    """
    user_info = UserService.get_current_user_info(request.user)
    
    return BaseResponse.success(
        data=user_info
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user_accesses(request):
    """
    Get accesses for currently logged-in user.
    GET /api/users/me/accesses/
    """
    accesses = UserService.get_user_accesses(request.user)
    
    return BaseResponse.success(
        data=accesses,
        message=f"{len(accesses)} access(es) retrieved"
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user_projects(request):
    """
    Get all projects assigned to currently logged-in user.
    GET /api/users/me/projects/
    """
    user = request.user
    if not user.is_authenticated:
        return BaseResponse.unauthorized(message=ErrorMessages.AUTHENTICATION_REQUIRED)
    
    projects = UserService.get_current_user_projects(user)
    serializer = ProjectResponseSerializer(projects, many=True)
    
    return BaseResponse.success(
        data={
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            },
            'count': len(projects),
            'projects': serializer.data
        }
    )
