from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from mobilys_BE.shared.response import BaseResponse
from user.models import Project, ProjectUserMap
from visualization.services.project_prefecture_service import (
    allowed_prefectures,
    get_project_prefecture,
    get_user_prefecture,
    normalize_prefecture_name,
    set_project_prefecture,
    set_user_prefecture,
)
from visualization.utils.share_util import normalize_project_id as _normalize_project_id
from visualization.constants.messages import Messages


class ProjectPrefectureSelectionAPIView(APIView):
    """
    Store or fetch the project-level prefecture override.
    Sending prefecture='default' (or empty) clears to the scenario fallback.
    """

    permission_classes = [IsAuthenticated]

    def _resolve_project(self, request):
        project_id = _normalize_project_id(
            request.data.get("project_id") if request.method == "POST" else request.query_params.get("project_id")
        )
        if not project_id:
            # User-scoped request
            return None, None

        project = Project.objects.filter(id=project_id).first()
        if not project:
            return None, Response({"message": Messages.PROJECT_NOT_FOUND_EN}, status=status.HTTP_404_NOT_FOUND)

        # Ensure caller belongs to the project
        if not ProjectUserMap.objects.filter(project_id=project_id, user=request.user).exists():
            return None, Response({"message": Messages.PROJECT_NOT_MEMBER_EN}, status=status.HTTP_403_FORBIDDEN)

        return project, None

    def get(self, request):
        project, error = self._resolve_project(request)
        if error:
            return error

        if project:
            pref = get_project_prefecture(project.id)
        else:
            pref = get_user_prefecture(request.user.id)

        data = {
            "project_id": str(project.id) if project else None,
            "prefecture": pref,
            "is_default": pref is None,
            "available_prefectures": allowed_prefectures(),
        }
        return BaseResponse(data=data, message=Messages.PROJECT_PREFECTURE_FETCHED_EN, status_code=status.HTTP_200_OK)

    def post(self, request):
        project, error = self._resolve_project(request)
        if error:
            return error

        raw_pref = request.data.get("prefecture") or request.data.get("prefecture_name")
        normalized = normalize_prefecture_name(raw_pref)

        has_payload = raw_pref is not None and str(raw_pref).strip() != ""
        is_default = has_payload and str(raw_pref).strip().lower() == "default"
        if has_payload and not is_default and normalized is None:
            return Response(
                {
                    "message": Messages.PROJECT_PREFECTURE_INVALID_EN,
                    "available_prefectures": allowed_prefectures(),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if project:
            stored = set_project_prefecture(project.id, normalized)
        else:
            stored = set_user_prefecture(request.user.id, normalized)

        data = {
            "project_id": str(project.id) if project else None,
            "prefecture": stored,
            "is_default": stored is None,
        }
        return BaseResponse(data=data, message=Messages.PROJECT_PREFECTURE_UPDATED_EN, status_code=status.HTTP_200_OK)
