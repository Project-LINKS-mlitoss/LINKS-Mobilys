# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path

from ..views.boarding_alighting_views import (
    BoardingAlightingCheckerViews,
    AvailableRouteKeywordsView,
    BoardingAlightingViews,
    BoardingAlightingClickDetailView,
    SegmentCatalogView,
    SegmentStopAnalyticsFilterView,
    SegmentStopAnalyticsView,
)

urlpatterns = [
    path("boarding-alighting/routes/", BoardingAlightingViews.as_view(), name="boarding-alighting-routes"),
    path("boarding-alighting-checker/", BoardingAlightingCheckerViews.as_view(), name="boarding-alighting-checker"),
    path("boarding-alighting/all-segment/", SegmentCatalogView.as_view(), name="boarding-alighting-all-segment"),
    path("boarding-alighting-checker/routes-group/", AvailableRouteKeywordsView.as_view(), name="boarding-alighting-routes-group"),
    path("boarding-alighting/segment-stop/", SegmentStopAnalyticsView.as_view(), name="boarding-alighting-segment-stop"),
    path("boarding-alighting/segment-stop/filter", SegmentStopAnalyticsFilterView.as_view(), name="boarding-alighting-segment-stop-filter"),
    path("boarding-alighting/routes-detail/", BoardingAlightingClickDetailView.as_view(), name="boarding-alighting-click-detail"),
]
