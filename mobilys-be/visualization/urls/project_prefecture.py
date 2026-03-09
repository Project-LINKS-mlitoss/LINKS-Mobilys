# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path

from ..views.project_prefecture_views import ProjectPrefectureSelectionAPIView

urlpatterns = [
    path("project-prefecture/", ProjectPrefectureSelectionAPIView.as_view(), name="project-prefecture-selection"),
]
