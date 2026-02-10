from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass(frozen=True)
class RidershipServiceError(Exception):
    message: str
    status_code: int
    payload: Optional[dict[str, Any]] = None

