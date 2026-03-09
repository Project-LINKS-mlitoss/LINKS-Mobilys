# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from gtfs.utils.scenario_utils import _norm_project_id
from mobilys_BE.shared.response import BaseResponse
from simulation.services.base import log_service_call
from user.models import ProjectUserMap


@dataclass
class ProjectScope:
    project_id: Optional[str]
    user_ids: List[int]


@log_service_call
def resolve_project_scope(request, project_id_raw: Optional[str] = None) -> Tuple[Optional[ProjectScope], Optional[BaseResponse]]:
    """
    Determine which user IDs are accessible for the request based on an optional project_id.
    Returns (scope, None) on success or (None, BaseResponse) containing the error to return.
    """
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return (
            None,
            BaseResponse(
                data=None,
                message="認証が必要です。",
                error="認証が必要です。",
                status_code=status.HTTP_401_UNAUTHORIZED,
            ),
        )

    project_id = _norm_project_id(
        project_id_raw if project_id_raw is not None else request.query_params.get("project_id")
    )

    if project_id:
        in_project = ProjectUserMap.objects.filter(project_id=project_id, user=user).exists()
        if not in_project:
            return (
                None,
                BaseResponse(
                    data=None,
                    message="このプロジェクトにアクセスする権限がありません。",
                    error="このプロジェクトにアクセスする権限がありません。",
                    status_code=status.HTTP_403_FORBIDDEN,
                ),
            )

        active_user_ids = list(
            ProjectUserMap.objects.filter(
                project_id=project_id,
                user__is_active=True,
            ).values_list("user_id", flat=True)
        )
        return ProjectScope(project_id=project_id, user_ids=active_user_ids), None

    return ProjectScope(project_id=None, user_ids=[user.id]), None


@log_service_call
def ensure_project_scope(request, project_id_raw: Optional[str] = None) -> ProjectScope:
    """
    Wrapper for resolve_project_scope that raises DRF exceptions when the scope is invalid.
    Useful inside get_queryset where returning a Response is not supported.
    """
    scope, error = resolve_project_scope(request, project_id_raw=project_id_raw)
    if error:
        raise_scope_error(error)
    return scope


def raise_scope_error(response: BaseResponse) -> None:
    """
    Convert a BaseResponse error into DRF exceptions that will propagate through standard handlers.
    """
    message = ""
    if hasattr(response, "data"):
        message = response.data.get("message") or response.data.get("error") or ""
    status_code = getattr(response, "status_code", None)

    if status_code == status.HTTP_401_UNAUTHORIZED:
        raise AuthenticationFailed(message or "認証が必要です。")
    raise PermissionDenied(message or "このプロジェクトにアクセスする権限がありません。")
