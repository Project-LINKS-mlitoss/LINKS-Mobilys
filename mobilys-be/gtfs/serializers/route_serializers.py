# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

# Backward-compatible exports.

from gtfs.serializers.request.route_request import RouteKeywordDataSerializer
from gtfs.serializers.response.route_response import RouteSerializer

__all__ = ["RouteSerializer", "RouteKeywordDataSerializer"]

