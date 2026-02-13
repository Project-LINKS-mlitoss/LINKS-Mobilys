# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path

from ..views.tile_proxy import tile_proxy

urlpatterns = [
    path("api/tile-proxy", tile_proxy, name="tile-proxy"),
    # Tile proxy (used by frontend as /api/visualization/tile-proxy)
    path("tile-proxy", tile_proxy, name="tile-proxy-no-slash"),
    path("tile-proxy/", tile_proxy, name="tile-proxy"),
]
