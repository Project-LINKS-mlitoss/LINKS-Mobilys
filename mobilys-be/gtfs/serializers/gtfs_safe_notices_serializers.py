# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

# Backward-compatible exports.

from gtfs.serializers.request.gtfs_safe_notices_request import (
    BulkUpsertSafeNoticeRulesSerializer,
    SafeNoticeRuleUpsertSerializer,
)
from gtfs.serializers.response.gtfs_safe_notices_response import SafeNoticeRuleListSerializer

__all__ = [
    "SafeNoticeRuleUpsertSerializer",
    "BulkUpsertSafeNoticeRulesSerializer",
    "SafeNoticeRuleListSerializer",
]

