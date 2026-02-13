# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Iterable, TypeVar

from django.db import transaction

from mobilys_BE.shared.log_json import log_service_call

T = TypeVar("T")


def transactional(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator to wrap a service method in a database transaction.

    Usage:
        @transactional
        def create_with_related(...):
            ...
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        with transaction.atomic():
            return func(*args, **kwargs)

    return wrapper


def chunked_transactional(chunk_size: int = 100) -> Callable[[Callable[..., Iterable[T]]], Callable[..., list[T]]]:
    """
    Decorator for batch operations with chunked transactions to avoid long-running transactions.

    The decorated function must return an iterable (commonly a generator). Items may be either:
    - a value (which will be collected and returned), or
    - a callable (which will be executed inside the transaction and its return value collected).

    Usage:
        @chunked_transactional(chunk_size=500)
        def ops(items):
            for item in items:
                yield lambda: Model.objects.create(**item)
    """

    if chunk_size <= 0:
        raise ValueError("chunk_size must be a positive integer")

    def decorator(func: Callable[..., Iterable[T]]) -> Callable[..., list[T]]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> list[T]:
            results: list[T] = []
            chunk: list[T] = []

            def flush(current: list[T]) -> None:
                if not current:
                    return
                with transaction.atomic():
                    for item in current:
                        if callable(item):
                            results.append(item())  # type: ignore[misc]
                        else:
                            results.append(item)

            for item in func(*args, **kwargs):
                chunk.append(item)
                if len(chunk) >= chunk_size:
                    flush(chunk)
                    chunk = []

            flush(chunk)
            return results

        return wrapper

    return decorator
