# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional


def round_decimal(value: Optional[Decimal], digits: int = 1) -> Decimal:
    x = value or Decimal("0")
    quant = Decimal("1").scaleb(-digits)
    return x.quantize(quant, rounding=ROUND_HALF_UP)


def round1(value: Optional[Decimal]) -> Decimal:
    return round_decimal(value, digits=1)


def round2(value: Optional[Decimal]) -> Decimal:
    return round_decimal(value, digits=2)


def to_decimal(value: Any, default: str = "0") -> Decimal:
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def to_decimal_or_none(value: Optional[Any]) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None

def to_decimal0(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return value if isinstance(value, Decimal) else Decimal(str(value))