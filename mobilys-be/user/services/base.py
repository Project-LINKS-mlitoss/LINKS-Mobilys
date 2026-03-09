# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.db import transaction
from functools import wraps

from mobilys_BE.shared.log_json import log_service_call


class ServiceException(Exception):
    """Base exception for service layer errors."""
    
    def __init__(self, message: str, code: str = None, details: dict = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(ServiceException):
    """Raised when validation fails."""
    pass


class NotFoundError(ServiceException):
    """Raised when entity is not found."""
    pass


class PermissionDeniedError(ServiceException):
    """Raised when user lacks permission."""
    pass


def transactional(func):
    """
    Decorator to wrap service method in database transaction.
    
    Usage:
        @transactional
        def create_with_related(self, data):
            # All operations here are atomic
            pass
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        with transaction.atomic():
            return func(*args, **kwargs)
    return wrapper
