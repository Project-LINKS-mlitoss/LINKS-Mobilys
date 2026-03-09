# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from gtfs.views.shape_views import (
    CreateShapeFromTripPatternsAPIView,
    GenerateShapeFromCoordinatesOnlyAPIView,
    GenerateShapeFromStopsAPIView,
    ShapeBulkUpdateAPIView,
    ShapeGeneratorViewSet,
)

router = DefaultRouter()

# Keep paths stable
router.register(r"generate/shape", ShapeGeneratorViewSet, basename="gtfs-shape-generate")

urlpatterns = router.urls + [
    path("generate/shape/from-stops/", GenerateShapeFromStopsAPIView.as_view(), name="gtfs-shape-generate-from-stops"),
    path(
        "generate/shape/from-coordinates/",
        GenerateShapeFromCoordinatesOnlyAPIView.as_view(),
        name="gtfs-shape-generate-from-coordinates",
    ),
    path("edit/shapes/bulk-update/", ShapeBulkUpdateAPIView.as_view(), name="gtfs-shape-bulk-update"),
    path(
        "edit/shapes/<str:scenario_id>/bulk-update/",
        ShapeBulkUpdateAPIView.as_view(),
        name="gtfs-shape-bulk-update-with-scenario",
    ),
    path(
        "edit/shapes/from-trip-patterns/",
        CreateShapeFromTripPatternsAPIView.as_view(),
        name="gtfs-shape-from-trip-patterns",
    ),
]

