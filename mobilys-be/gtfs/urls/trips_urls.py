# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from django.urls import path

from gtfs.views.trip_views import (
    PreviewShapeCoordinatesAPIView,
    TripEditGetDetailEditDataBulkDeleteAPIView,
    TripListCreateAPIView,
)

urlpatterns = [
    path("edit/trips/", TripListCreateAPIView.as_view(), name="gtfs-trips-list-create"),
    path(
        "edit/trips/bulk-delete/",
        TripEditGetDetailEditDataBulkDeleteAPIView.as_view(),
        name="gtfs-trips-bulk-delete",
    ),
    path("preview-shape/", PreviewShapeCoordinatesAPIView.as_view(), name="gtfs-shape-preview-coordinates"),
    path(
        "edit/trips/<str:scenario_id>/<str:trip_id>/",
        TripEditGetDetailEditDataBulkDeleteAPIView.as_view(),
        name="gtfs-trips-detail",
    ),
]

