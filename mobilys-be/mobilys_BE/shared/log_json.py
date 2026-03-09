# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

import functools
import inspect
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from mobilys_BE.shared.request_context import get_request_id, get_user_id, get_scenario_id


def log_json(logger: logging.Logger, level: int, message: str, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "level": logging.getLevelName(level),
        "message": message,
    }

    request_id = get_request_id()
    if request_id:
        payload["request_id"] = request_id

    user_id = get_user_id()
    if user_id:
        payload["user_id"] = user_id

    scenario_id = get_scenario_id()
    if scenario_id:
        payload["scenario_id"] = scenario_id

    payload.update(fields)

    logger.log(level, json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def log_service_call(
    func=None,
    *,
    logger: logging.Logger | None = None,
    start_level: int = logging.INFO,
    end_level: int = logging.INFO,
    error_level: int = logging.ERROR,
    start_message: str = "service_call",
    end_message: str = "service_call_completed",
    error_message: str = "service_call_failed",
):
    """
    Decorator to log service method calls using `log_json`.

    Intended usage:
        @staticmethod
        @log_service_call
        def some_service_method(...): ...

    Notes:
    - Does not log args/kwargs to avoid leaking sensitive data.
    - Adds duration and (if available) response status_code.
    """

    def decorator(target):
        if isinstance(target, type):
            return _decorate_service_class(target)

        return _decorate_callable(target)

    def _extract_safe_call_fields(target_callable, args, kwargs) -> dict[str, Any]:
        try:
            signature = inspect.signature(target_callable)
            bound = signature.bind_partial(*args, **kwargs)
        except Exception:
            return {}

        fields: dict[str, Any] = {}
        arguments = bound.arguments

        user = arguments.get("user")
        if user is not None and hasattr(user, "id"):
            try:
                fields["user_id"] = str(user.id)
            except Exception:
                pass

        for name in ("scenario_id", "upload_id", "notification_id", "route_id", "stop_id", "trip_id", "shape_id"):
            value = arguments.get(name)
            if value is None:
                continue
            if isinstance(value, (str, int)):
                fields[name] = str(value)
            else:
                try:
                    fields[name] = str(value)
                except Exception:
                    pass

        return fields

    def _extract_result_fields(result: Any) -> dict[str, Any]:
        fields: dict[str, Any] = {}

        status_code = getattr(result, "status_code", None)
        if isinstance(status_code, int):
            fields["status_code"] = status_code

        if isinstance(result, (list, tuple, set, dict)):
            fields["result_count"] = len(result)

        return fields

    def _decorate_callable(target_callable):
        if getattr(target_callable, "_log_service_call_applied", False):
            return target_callable

        resolved_logger = logger or logging.getLogger(target_callable.__module__)
        service_name = getattr(target_callable, "__qualname__", getattr(target_callable, "__name__", "unknown"))
        service_module = getattr(target_callable, "__module__", "unknown")

        def _base_fields(duration_ms: float | None = None) -> dict[str, Any]:
            fields: dict[str, Any] = {"service": service_name, "module": service_module}
            if duration_ms is not None:
                fields["duration_ms"] = round(duration_ms, 3)
            return fields

        if inspect.iscoroutinefunction(target_callable):

            @functools.wraps(target_callable)
            async def async_wrapper(*args, **kwargs):
                start_ns = time.monotonic_ns()
                log_json(
                    resolved_logger,
                    start_level,
                    start_message,
                    **_base_fields(),
                    **_extract_safe_call_fields(target_callable, args, kwargs),
                )
                try:
                    result = await target_callable(*args, **kwargs)
                except Exception as exc:
                    duration_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                    log_json(
                        resolved_logger,
                        error_level,
                        error_message,
                        **_base_fields(duration_ms),
                        **_extract_safe_call_fields(target_callable, args, kwargs),
                        error_type=type(exc).__name__,
                        error=str(exc),
                    )
                    raise

                duration_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                log_json(
                    resolved_logger,
                    end_level,
                    end_message,
                    **_base_fields(duration_ms),
                    **_extract_safe_call_fields(target_callable, args, kwargs),
                    **_extract_result_fields(result),
                )
                return result

            async_wrapper._log_service_call_applied = True  # type: ignore[attr-defined]
            return async_wrapper

        @functools.wraps(target_callable)
        def wrapper(*args, **kwargs):
            start_ns = time.monotonic_ns()
            log_json(
                resolved_logger,
                start_level,
                start_message,
                **_base_fields(),
                **_extract_safe_call_fields(target_callable, args, kwargs),
            )
            try:
                result = target_callable(*args, **kwargs)
            except Exception as exc:
                duration_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                log_json(
                    resolved_logger,
                    error_level,
                    error_message,
                    **_base_fields(duration_ms),
                    **_extract_safe_call_fields(target_callable, args, kwargs),
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
                raise

            duration_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            log_json(
                resolved_logger,
                end_level,
                end_message,
                **_base_fields(duration_ms),
                **_extract_safe_call_fields(target_callable, args, kwargs),
                **_extract_result_fields(result),
            )
            return result

        wrapper._log_service_call_applied = True  # type: ignore[attr-defined]
        return wrapper

    def _decorate_service_class(cls):
        for name, attr in list(vars(cls).items()):
            if name.startswith("_"):
                continue

            if isinstance(attr, staticmethod):
                original = attr.__func__
                decorated = _decorate_callable(original)
                if decorated is not original:
                    setattr(cls, name, staticmethod(decorated))
                continue

            if isinstance(attr, classmethod):
                original = attr.__func__
                decorated = _decorate_callable(original)
                if decorated is not original:
                    setattr(cls, name, classmethod(decorated))
                continue

            if inspect.isfunction(attr):
                decorated = _decorate_callable(attr)
                if decorated is not attr:
                    setattr(cls, name, decorated)

        return cls

    if func is None:
        return decorator

    return decorator(func)
