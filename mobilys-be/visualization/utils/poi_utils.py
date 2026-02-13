# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import re, unicodedata, math
from visualization.constants.messages import Messages

_FLOAT_RE = re.compile(r'^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$')

def parse_strict_float(s: str) -> float:
    t = unicodedata.normalize('NFKC', (s or '').strip())
    if ',' in t or ' ' in t:
        raise ValueError(Messages.POI_COMMA_SPACE_NOT_ALLOWED_EN)
    if not _FLOAT_RE.match(t):
        raise ValueError(Messages.POI_INVALID_FLOAT_FORMAT_EN)
    return float(t)
