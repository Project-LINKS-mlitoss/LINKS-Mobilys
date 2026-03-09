# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework.routers import DefaultRouter

from gtfs.views.calendar_views import CalendarViewSet

router = DefaultRouter()

# Keep paths stable
router.register(r"calendar", CalendarViewSet, basename="gtfs-calendar")

urlpatterns = router.urls

