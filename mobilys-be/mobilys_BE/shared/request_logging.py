from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Optional

from django.conf import settings
from django.db import connection
from django.utils import timezone

from mobilys_BE.shared.log_json import log_json
from mobilys_BE.shared.request_context import (
    set_request_id,
    reset_request_id,
    set_user_id,
    reset_user_id,
    set_scenario_id,
    reset_scenario_id,
)

import contextvars
_db_stats_var: contextvars.ContextVar[Optional["DbStats"]] = contextvars.ContextVar("db_stats", default=None)


@dataclass
class DbStats:
    query_count: int = 0
    total_time_ms: float = 0.0


class RequestIdMiddleware:
    """
    - request_id uses X-Request-Id if present, else generated.
    - Always set X-Request-Id on response.
    """

    header_name = "HTTP_X_REQUEST_ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.META.get(self.header_name)
        rid = (incoming or "").strip() or str(uuid.uuid4())

        token = set_request_id(rid)
        try:
            response = self.get_response(request)
        finally:
            reset_request_id(token)

        response["X-Request-Id"] = rid
        return response


class DbTimingMiddleware:
    """
    Tracks:
    - db_query_count
    - db_time_ms
    Can be toggled via env/config.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        enabled = getattr(settings, "DB_TIMING_LOG_ENABLED", False)
        if not enabled:
            return self.get_response(request)

        stats = DbStats()
        token = _db_stats_var.set(stats)

        def _wrapper(execute, sql, params, many, context):
            start = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                stats.query_count += 1
                stats.total_time_ms += elapsed_ms

        try:
            with connection.execute_wrapper(_wrapper):
                return self.get_response(request)
        finally:
            _db_stats_var.reset(token)

def _extract_scenario_id(request) -> Optional[str]:
    # 1) URL kwargs
    rm = getattr(request, "resolver_match", None)
    if rm and getattr(rm, "kwargs", None):
        for key in ("scenario_id", "scenarioId"):
            val = rm.kwargs.get(key)
            if val:
                return str(val)

    # 2) Query params
    qp = getattr(request, "GET", None)
    if qp:
        val = qp.get("scenario_id") or qp.get("scenarioId")
        if val:
            return str(val)

    # 3) JSON body (optional + safe)
    if request.method not in getattr(settings, "REQUEST_LOG_BODY_METHODS", ("POST", "PUT", "PATCH")):
        return None

    content_type = (request.META.get("CONTENT_TYPE") or "").lower()
    if "application/json" not in content_type:
        return None

    max_bytes = int(getattr(settings, "REQUEST_LOG_BODY_MAX_BYTES", 65536))
    try:
        raw = request.body  # Django caches it; still don't do this for huge payloads
        if not raw or len(raw) > max_bytes:
            return None
        data = json.loads(raw.decode("utf-8"))
        if isinstance(data, dict):
            val = data.get("scenario_id") or data.get("scenarioId")
            if val:
                return str(val)
    except Exception:
        return None

    return None

def _safe_body_summary(request) -> Optional[dict[str, Any]]:
    if not getattr(settings, "REQUEST_LOG_BODY_ENABLED", False):
        return None

    if request.method not in getattr(settings, "REQUEST_LOG_BODY_METHODS", ("POST", "PUT", "PATCH")):
        return None

    content_type = (request.META.get("CONTENT_TYPE") or "").lower()
    if "application/json" not in content_type:
        return {"content_type": content_type, "note": "non_json_body_not_logged"}

    max_bytes = int(getattr(settings, "REQUEST_LOG_BODY_MAX_BYTES", 65536))
    try:
        raw = request.body
        if not raw:
            return {"content_type": content_type, "bytes": 0}

        if len(raw) > max_bytes:
            return {"content_type": content_type, "bytes": len(raw), "note": "body_too_large"}

        data = json.loads(raw.decode("utf-8"))

        # Default: keys only (safe). If you want more, use allowlist.
        allowlist = getattr(settings, "REQUEST_LOG_BODY_ALLOWLIST", None)
        redact_keys = set(getattr(settings, "REQUEST_LOG_BODY_REDACT_KEYS", ("password", "token", "access", "refresh")))

        if isinstance(data, dict):
            keys = sorted(data.keys())
            if allowlist:
                filtered = {k: data.get(k) for k in allowlist if k in data}
                for k in list(filtered.keys()):
                    if k.lower() in redact_keys:
                        filtered[k] = "***"
                return {"content_type": content_type, "keys": keys, "allowlisted": filtered}

            return {"content_type": content_type, "keys": keys, "bytes": len(raw)}

        # If list/other: don’t dump it
        return {"content_type": content_type, "type": type(data).__name__, "bytes": len(raw)}
    except Exception:
        return {"content_type": content_type, "note": "body_unparseable"}

class StructuredRequestLogMiddleware:
    """
    One structured log entry per request.
    Includes request_id always. Adds optional user_id and scenario_id when available.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger("request")

    def __call__(self, request):
        started = time.perf_counter()
        method = request.method
        path = request.get_full_path()

        excluded_prefixes = getattr(settings, "REQUEST_LOG_EXCLUDE_PREFIXES", [])
        if any(request.path.startswith(p) for p in excluded_prefixes):
            return self.get_response(request)

        # Cheap scenario_id only (URL/query). Do NOT parse body unless error.
        scenario_token = None
        scenario_id = _extract_scenario_id(request, parse_body=False)
        if scenario_id:
            scenario_token = set_scenario_id(scenario_id)

        status_code = 200
        try:
            response = self.get_response(request)
            status_code = int(getattr(response, "status_code", 200))
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            duration_ms = (time.perf_counter() - started) * 1000.0
            stats = _db_stats_var.get() or DbStats()

            user_token = None
            error_fields: Optional[dict[str, Any]] = None

            try:
                user = getattr(request, "user", None)
                if user is not None and getattr(user, "is_authenticated", False):
                    user_token = set_user_id(str(user.pk))

                fields: dict[str, Any] = {
                    "method": method,
                    "path": path,
                    "status_code": int(status_code),
                    "duration_ms": round(duration_ms, 3),
                    "db_query_count": int(stats.query_count),
                    "db_time_ms": round(stats.total_time_ms, 3),
                }

                # Only on 4xx/5xx: log request body summary (and try body-based scenario_id if missing)
                if status_code >= 400:
                    if not scenario_id:
                        sid_from_body = _extract_scenario_id(request, parse_body=True)
                        if sid_from_body:
                            # set context var so log_json includes it
                            scenario_id = sid_from_body
                            scenario_token = set_scenario_id(sid_from_body)

                    body_summary = _safe_body_summary(request)
                    if body_summary is not None:
                        fields["request_body"] = body_summary

                if status_code >= 500:
                    exc_obj = locals().get("exc")
                    if exc_obj:
                        fields["error"] = {"type": exc_obj.__class__.__name__, "message": str(exc_obj)}
                    log_json(self.logger, logging.ERROR, "http_request", **fields)
                elif status_code >= 400:
                    log_json(self.logger, logging.WARNING, "http_request", **fields)
                else:
                    log_json(self.logger, logging.INFO, "http_request", **fields)
            finally:
                if user_token is not None:
                    reset_user_id(user_token)
                if scenario_token is not None:
                    reset_scenario_id(scenario_token)

def _extract_scenario_id(request, *, parse_body: bool) -> Optional[str]:
    # 1) URL kwargs
    rm = getattr(request, "resolver_match", None)
    if rm and getattr(rm, "kwargs", None):
        for key in ("scenario_id", "scenarioId"):
            val = rm.kwargs.get(key)
            if val:
                return str(val)

    # 2) Query params
    qp = getattr(request, "GET", None)
    if qp:
        val = qp.get("scenario_id") or qp.get("scenarioId")
        if val:
            return str(val)

    # 3) JSON body (optional)
    if not parse_body:
        return None

    if request.method not in getattr(settings, "REQUEST_LOG_BODY_METHODS", ("POST", "PUT", "PATCH")):
        return None

    content_type = (request.META.get("CONTENT_TYPE") or "").lower()
    if "application/json" not in content_type:
        return None

    max_bytes = int(getattr(settings, "REQUEST_LOG_BODY_MAX_BYTES", 65536))
    try:
        raw = request.body
        if not raw or len(raw) > max_bytes:
            return None
        data = json.loads(raw.decode("utf-8"))
        if isinstance(data, dict):
            val = data.get("scenario_id") or data.get("scenarioId")
            if val:
                return str(val)
    except Exception:
        return None

    return None
