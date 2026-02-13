# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path

from ..views.population_mesh_views import PopulationByPrefectureView

urlpatterns = [
    path("population_by_prefecture/", PopulationByPrefectureView.as_view(), name="population_by_prefecture"),
]
