from __future__ import annotations

# Backward-compatible exports.
# Prefer importing from `gtfs.serializers.request.*` and `gtfs.serializers.response.*` for new code.

from gtfs.serializers.request.stop_request import (
    ExtendedTimeField,
    StopEditRequestSerializer as StopEditSerializer,
    StopIdKeywordUpdateSerializer,
    StopNameKeywordsUpdateSerializer,
    StopTimesCreateUpdateSerializer,
)
from gtfs.serializers.response.stop_response import StopSerializer, StopTimesSerializer

__all__ = [
    "ExtendedTimeField",
    "StopEditSerializer",
    "StopSerializer",
    "StopTimesSerializer",
    "StopTimesCreateUpdateSerializer",
    "StopNameKeywordsUpdateSerializer",
    "StopIdKeywordUpdateSerializer",
]

