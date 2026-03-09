# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from mobilys_BE.shared.response import BaseResponse
from user.services import AccessService, NotFoundError, ValidationError
from user.serializers.request import (
    CreateAccessRequestSerializer,
    UpdateAccessRequestSerializer,
    ListAccessesRequestSerializer,
)
from user.serializers.response import (
    AccessResponseSerializer,
    AccessListResponseSerializer,
    RoleListResponseSerializer,
)
import logging
from mobilys_BE.shared.log_json import log_json
from user.utils.errors import ErrorMessages

logger = logging.getLogger(__name__)


class AccessViewSet(viewsets.ViewSet):
    """
    ViewSet for CRUD operations on Access.
    
    Views are thin - they handle HTTP concerns only.
    All business logic is delegated to AccessService.
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """Use different serializer for list and detail."""
        if self.action == 'list':
            return AccessListResponseSerializer
        return AccessResponseSerializer
    
    def list(self, request):
        """
        Get all accesses.
        Query params: search
        """
        request_serializer = ListAccessesRequestSerializer(data=request.query_params)

        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "access_list_validation_failed",
                request=request.query_params,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )

        search = request_serializer.validated_data.get('search')
        
        accesses = AccessService.list_accesses(search=search)
        serializer = AccessListResponseSerializer(accesses, many=True)
        
        return BaseResponse.success(
            data=serializer.data,
            message=f"{len(accesses)} access(es) retrieved"
        )
    
    def create(self, request):
        """Create new access."""
        request_serializer = CreateAccessRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "access_create_validation_failed",
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            access = AccessService.create_access(**request_serializer.validated_data)
            access = AccessService.get_access_with_computed_fields(access)
            response_serializer = AccessResponseSerializer(access)
            
            return BaseResponse.created(
                data=response_serializer.data,
                message="Access created successfully"
            )
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "access_create_failed",
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    def retrieve(self, request, pk=None):
        """Get single access by ID."""
        try:
            access = AccessService.get_by_id(pk)
            access = AccessService.get_access_with_computed_fields(access)
            serializer = AccessResponseSerializer(access)
            
            return BaseResponse.success(data=serializer.data)
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "access_retrieve_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    def update(self, request, pk=None):
        """Update access (full update - PUT)."""
        request_serializer = UpdateAccessRequestSerializer(data=request.data)
        
        if not request_serializer.is_valid():
            log_json(
                logger,
                logging.ERROR,
                "access_update_validation_failed",
                pk=pk,
                request=request.data,
                error=request_serializer.errors
            )
            return BaseResponse.bad_request(
                message=ErrorMessages.VALIDATION_ERROR,
                error=request_serializer.errors
            )
        
        try:
            access = AccessService.update_access(pk, **request_serializer.validated_data)
            access = AccessService.get_access_with_computed_fields(access)
            response_serializer = AccessResponseSerializer(access)
            
            return BaseResponse.success(
                data=response_serializer.data,
                message="Access updated successfully"
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "access_update_not_found",
                pk=pk,
                request=request.data,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
        except ValidationError as e:
            log_json(
                logger,
                logging.ERROR,
                "access_update_failed",
                pk=pk,
                request=request.data,
                error=e.details
            )
            return BaseResponse.bad_request(message=e.message, error=e.details)
    
    def partial_update(self, request, pk=None):
        """Partial update access (PATCH)."""
        return self.update(request, pk)
    
    def destroy(self, request, pk=None):
        """Delete access."""
        try:
            access_name = AccessService.delete_access(pk)
            return BaseResponse.success(
                message=f'Access "{access_name}" deleted successfully'
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "access_delete_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
    
    @action(detail=True, methods=['get'])
    def roles(self, request, pk=None):
        """Get all roles that have this access. GET /api/accesses/{id}/roles/"""
        try:
            roles = AccessService.get_access_roles(pk)
            serializer = RoleListResponseSerializer(roles, many=True)
            
            return BaseResponse.success(
                data=serializer.data,
                message=f"{len(roles)} role(s) with this access"
            )
        except NotFoundError as e:
            log_json(
                logger,
                logging.ERROR,
                "access_roles_not_found",
                pk=pk,
                error=e.message
            )
            return BaseResponse.not_found(message=e.message)
