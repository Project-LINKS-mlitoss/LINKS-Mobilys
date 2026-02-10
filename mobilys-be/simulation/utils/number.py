from typing import Any, Optional


def safe_div(a: float, b: float) -> float:
    return 0.0 if b == 0 else a / b


def round_float(value: float, ndigits: int = 0) -> float:
    return round(float(value), ndigits)


def round0(value: float) -> float:
    return round_float(value, 0)


def round1(value: float) -> float:
    return round_float(value, 1)


def round4(value: float) -> float:
    return round_float(value, 4)


def to_float_or_none(value: Optional[Any]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def to_float_or_zero(value: Optional[Any]) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0
