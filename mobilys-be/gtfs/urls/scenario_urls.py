# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework.routers import DefaultRouter

from gtfs.views.scenario_views import ScenarioAPIViewSet, ScenarioLocalViewSet

router = DefaultRouter()

# Keep paths stable
router.register(r"import", ScenarioLocalViewSet, basename="gtfs-scenario-import")
router.register(r"api", ScenarioAPIViewSet, basename="gtfs-scenario-api")

urlpatterns = router.urls

