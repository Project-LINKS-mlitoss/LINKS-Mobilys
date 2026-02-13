# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

# Backward-compatible exports.
# Prefer importing from `gtfs.serializers.request.*` and `gtfs.serializers.response.*` for new code.

from gtfs.serializers.request.ridership_request import RidershipUploadRequestSerializer
from gtfs.serializers.response.ridership_response import (
    RidershipRecordSerializer,
    RidershipUploadDetailSerializer,
    RidershipUploadErrorSerializer,
    RidershipUploadListSerializer,
    RidershipUploadResponseSerializer,
)

__all__ = [
    "RidershipUploadRequestSerializer",
    "RidershipUploadErrorSerializer",
    "RidershipRecordSerializer",
    "RidershipUploadResponseSerializer",
    "RidershipUploadListSerializer",
    "RidershipUploadDetailSerializer",
]

