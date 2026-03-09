# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from mobilys_BE.shared.response import BaseResponse
from user.services import OrganizationService, NotFoundError, ValidationError
from user.serializers.request import (
    CreateOrganizationRequestSerializer,
    UpdateOrganizationRequestSerializer,
    ChangeOrganizerRequestSerializer,
    ListOrganizationsRequestSerializer,
    ListOrganizationsByOrganizerRequestSerializer,
)
from user.serializers.response import (
    OrganizationResponseSerializer,
    OrganizationListResponseSerializer,
)
import logging
from mobilys_BE.shared.log_json import log_json
from user.utils.errors import ErrorMessages
from user.utils.transform import apply_explicit_nullable_field

logger = logging.getLogger(__name__)


class OrganizationViewSet(viewsets.ViewSet):
    """
    ViewSet for CRUD operations on Organization.
    
    Views are thin - they handle HTTP concerns only.
    All business logic is delegated to OrganizationService.
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Use different serializer for list and detail."""
        if self.action == 'list':
            return OrganizationListResponseSerializer
        return OrganizationResponseSerializer
    
    def list(self, request):
        """
        Get all organizations.
        Query params: active, search, organizer_id, section
        """
        request_serializer = ListOrganizationsRequestSerializer(data=request.query_params)

        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "organization_list_validation_failed",
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
        organizer_id = validated_data.get('organizer_id')
        section = validated_data.get('section')
        
        organizations = OrganizationService.list_organizations(
            active=active,
            search=search,
            organizer_id=organizer_id,
            section=section
        )
        serializer = OrganizationListResponseSerializer(organizations, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(organizations)} organization(s) retrieved"
        )
    
    def create(self, request):
        """Create new organization."""
        request_serializer = CreateOrganizationRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "organization_create_validation_failed",
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            organization = OrganizationService.create_organization(**request_serializer.validated_data)
            organization = OrganizationService.get_organization_with_computed_fields(organization)
            response_serializer = OrganizationResponseSerializer(organization)
            
            return BaseResponse.created(
                data=response_serializer.data,
                message="Organization created successfully"
            )
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_create_validation_error",
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_create_not_found",
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    def retrieve(self, request, pk=None):
        """Get single organization by ID."""
        try:
            organization = OrganizationService.get_by_id(pk)
            organization = OrganizationService.get_organization_with_computed_fields(organization)
            serializer = OrganizationResponseSerializer(organization)
            
            return BaseResponse.success(data=serializer.data)
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_retrieve_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    def update(self, request, pk=None):
        """Update organization (full update - PUT)."""
        request_serializer = UpdateOrganizationRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "organization_update_validation_failed",
                pk=pk,
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            validated_data = request_serializer.validated_data.copy()
            
            # Handle organizer_id - check raw request.data to detect explicit null
            apply_explicit_nullable_field(
                validated_data,
                request.data,
                "organizer_id",
                caster=int,
            )
            
            organization = OrganizationService.update_organization(pk, **validated_data)
            organization = OrganizationService.get_organization_with_computed_fields(organization)
            response_serializer = OrganizationResponseSerializer(organization)
            
            return BaseResponse.success(
                data=response_serializer.data,
                message="Organization updated successfully"
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_update_not_found",
                pk=pk,
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_update_validation_error",
                pk=pk,
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    def partial_update(self, request, pk=None):
        """Partial update organization (PATCH)."""
        return self.update(request, pk)
    
    def destroy(self, request, pk=None):
        """Delete organization."""
        try:
            organization_name = OrganizationService.delete_organization(pk)
            return BaseResponse.success(
                message=f'Organization "{organization_name}" deleted successfully'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_delete_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get only active organizations. GET /api/organizations/active/"""
        organizations = OrganizationService.list_organizations(active=True)
        serializer = OrganizationListResponseSerializer(organizations, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(organizations)} active organization(s) retrieved"
        )
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """
        Toggle active status for organization and all its users (except super_user).
        POST /api/organizations/{id}/toggle_active/
        """
        try:
            result = OrganizationService.toggle_active(pk)
            organization = OrganizationService.get_organization_with_computed_fields(result['organization'])
            serializer = OrganizationResponseSerializer(organization)
            
            return BaseResponse.success(
                data={
                    'organization': serializer.data,
                    'organization_status': result['organization_status'],
                    'affected_users_count': result['affected_users_count'],
                    'affected_users': result['affected_users'],
                    'super_users_count': result['super_users_count'],
                    'super_users': result['super_users'],
                    'note': 'Super users are not affected by organization status changes'
                },
                message=f'Organization is now {result["organization_status"]}'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_toggle_active_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_toggle_active_failed",
                pk=pk,
                error=str(e)
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.FAILED_TOGGLE_ORG_STATUS,
                error=str(e)
            )
    
    @action(detail=False, methods=['get'])
    def by_organizer(self, request):
        """
        Get organizations by organizer user ID.
        GET /api/organizations/by_organizer/?user_id=xxx
        """
        request_serializer = ListOrganizationsByOrganizerRequestSerializer(
            data=request.query_params
        )

        if not request_serializer.is_valid():
            message = ErrorMessages.VALIDATION_ERROR
            if not request.query_params.get('user_id'):
                message = ErrorMessages.USER_ID_PARAM_REQUIRED
            
            log_json(
                logger,
                logging.ERROR,
                "organization_by_organizer_validation_failed",
                request=request.query_params,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=message,
                error=request_serializer.errors
            )

        user_id = request_serializer.validated_data['user_id']
        
        organizations = OrganizationService.get_by_organizer(user_id)
        serializer = OrganizationListResponseSerializer(organizations, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(organizations)} organization(s) retrieved"
        )
    
    @action(detail=True, methods=['post'])
    def change_organizer(self, request, pk=None):
        """
        Change organizer of an organization.
        POST /api/organizations/{id}/change_organizer/
        """
        request_serializer = ChangeOrganizerRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "organization_change_organizer_validation_failed",
                pk=pk,
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            result = OrganizationService.change_organizer(
                pk,
                request_serializer.validated_data['organizer_id']
            )
            organization = OrganizationService.get_organization_with_computed_fields(result['organization'])
            serializer = OrganizationResponseSerializer(organization)
            
            return BaseResponse.success(
                data=serializer.data,
                message=f'Organizer changed from {result["old_organizer"]} to {result["new_organizer"]}'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "organization_change_organizer_not_found",
                pk=pk,
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)


# NEED DELETE AFTER INTEGRATION - Legacy exports for backward compatibility
__all__ = ['OrganizationViewSet']
