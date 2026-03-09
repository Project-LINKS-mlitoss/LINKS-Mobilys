# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from gtfs.views.map_views import MapListView, UserMapEditView

router = DefaultRouter()

# Keep paths stable
router.register(r"maps", MapListView, basename="gtfs-maps")

urlpatterns = router.urls + [
    path("user/map/", UserMapEditView.as_view(), name="gtfs-user-map-update"),
]

