# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path

from ..views.road_network_reachability import (
    RoadNetworkReachability,
    RoadNetworkReachabilityAnalysis,
    BuildOTPGraph,
    PrefectureAvailability,
)

urlpatterns = [
    path("road-network-reachability/", RoadNetworkReachability.as_view(), name="fp005-road-network-reachability"),
    path("road-network-reachability/analysis/", RoadNetworkReachabilityAnalysis.as_view(), name="fp005-road-network-reachability-analysis"),
    path("buildOTPGraph/<uuid:pk>/", BuildOTPGraph.as_view(), name="fp005-build-otp-graph"),
    path("prefecture-availability/<uuid:pk>/", PrefectureAvailability.as_view(), name="prefecture-availability-detail"),
]
