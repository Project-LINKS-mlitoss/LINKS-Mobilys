# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Grouped URL patterns for visualization views.
"""

from .boarding_alighting import urlpatterns as boarding_alighting_urlpatterns
from .buffer_analysis import urlpatterns as buffer_analysis_urlpatterns
from .od_analysis import urlpatterns as od_analysis_urlpatterns
from .poi import urlpatterns as poi_urlpatterns
from .population_mesh import urlpatterns as population_mesh_urlpatterns
from .project_prefecture import urlpatterns as project_prefecture_urlpatterns
from .road_network_reachability import urlpatterns as road_network_reachability_urlpatterns
from .stop_radius_analysis import urlpatterns as stop_radius_analysis_urlpatterns
from .tile_proxy import urlpatterns as tile_proxy_urlpatterns
from .total_bus_running import urlpatterns as total_bus_running_urlpatterns

urlpatterns = [
    *total_bus_running_urlpatterns,
    *road_network_reachability_urlpatterns,
    *buffer_analysis_urlpatterns,
    *population_mesh_urlpatterns,
    *stop_radius_analysis_urlpatterns,
    *od_analysis_urlpatterns,
    *project_prefecture_urlpatterns,
    *poi_urlpatterns,
    *tile_proxy_urlpatterns,
    *boarding_alighting_urlpatterns,
]
