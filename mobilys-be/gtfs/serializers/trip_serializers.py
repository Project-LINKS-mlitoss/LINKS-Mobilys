from __future__ import annotations

# Backward-compatible exports.
# Prefer importing from `gtfs.serializers.request.*` and `gtfs.serializers.response.*` for new code.

from gtfs.serializers.request.trip_request import TripUpsertRequestSerializer
from gtfs.serializers.response.trip_response import AdjustmentSerializer, TripModelSerializer, TripSerializer

__all__ = [
    "AdjustmentSerializer",
    "TripSerializer",
    "TripModelSerializer",
    "TripUpsertRequestSerializer",
]

