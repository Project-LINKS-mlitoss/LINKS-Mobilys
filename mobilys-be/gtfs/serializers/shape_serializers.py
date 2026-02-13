# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

# Backward-compatible exports.

from gtfs.serializers.request.shape_request import (
    BulkShapeUpdateSerializer,
    CreateShapeFromTripPatternsSerializer,
    GenerateShapeFromCoordinatesOnlySerializer,
    GenerateShapeFromStopsSerializer,
    GenerateShapeSerializer,
    ShapeCoordinateCreateSerializer,
    ShapeCreatePayloadSerializer,
    ShapePointPatchSerializer,
    TripPatternShapeUpdateSerializer,
)

__all__ = [
    "GenerateShapeSerializer",
    "ShapePointPatchSerializer",
    "BulkShapeUpdateSerializer",
    "GenerateShapeFromStopsSerializer",
    "GenerateShapeFromCoordinatesOnlySerializer",
    "TripPatternShapeUpdateSerializer",
    "ShapeCoordinateCreateSerializer",
    "ShapeCreatePayloadSerializer",
    "CreateShapeFromTripPatternsSerializer",
]

