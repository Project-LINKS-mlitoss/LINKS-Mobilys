# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path

from ..views.buffer_analysis_views import (
    BufferAnalysisNearestStopsAPIViewOriginals,
    BufferAnalysisGraphAPIView,
    BufferAnalysisNearestStopsAPIQueryView,
    ShowAllRoutesAPIView,
)

urlpatterns = [
    path("buffer-analysis-visualization/", BufferAnalysisNearestStopsAPIViewOriginals.as_view(), name="fp004-buffer-analysis-visualization"),
    path("buffer-analysis-visualization/graph/", BufferAnalysisGraphAPIView.as_view(), name="fp004-buffer-analysis-visualization-graph"),
    path("all-routes/", ShowAllRoutesAPIView.as_view(), name="all-routes-and-stops"),
]
