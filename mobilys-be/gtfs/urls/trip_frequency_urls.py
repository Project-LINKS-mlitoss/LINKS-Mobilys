# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from gtfs.views.trip_frequency_views import TripDetailViewSet, TripFrequencyViewSet

router = DefaultRouter()

# Keep paths stable
router.register(r"edit/trip/frequency", TripFrequencyViewSet, basename="gtfs-trip-frequency")
router.register(r"edit/trip/frequency-trip-detail", TripDetailViewSet, basename="gtfs-trip-detail")

urlpatterns = router.urls + [
    path(
        "edit/trip/frequency-trip-map/",
        TripDetailViewSet.as_view({"get": "coordinates"}),
        name="gtfs-trip-detail-coordinates",
    ),
]

