# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Optional, Tuple


def sort_key_casefold(value: Optional[str]) -> Tuple[str]:
    return ((value or "").lower(),)
