# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from rest_framework import serializers


class BaseRequestSerializer(serializers.Serializer):
    """
    Base class for request serializers.

    Rules:
    - Validate/normalize input only
    - No business logic
    - No ORM access
    """


class BaseResponseSerializer(serializers.Serializer):
    """
    Base class for response serializers.

    Rules:
    - Formatting/output only
    - No business logic
    - No ORM access
    """

