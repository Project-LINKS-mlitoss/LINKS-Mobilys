# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from functools import wraps
from typing import Any, Callable, TypeVar

from django.db import transaction
from rest_framework import status as http_status

from mobilys_BE.shared.log_json import log_service_call

T = TypeVar("T")


class ServiceError(Exception):
    def __init__(self, message: str, error=None, status_code: int = http_status.HTTP_400_BAD_REQUEST):
        """Base exception for service errors."""
        super().__init__(message)
        self.message = message
        self.error = error or message
        self.status_code = status_code


def transactional(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator to wrap a service or API method in a database transaction.
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        with transaction.atomic():
            return func(*args, **kwargs)

    return wrapper
