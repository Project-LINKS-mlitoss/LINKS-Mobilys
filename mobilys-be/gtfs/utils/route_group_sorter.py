# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import locale
import string

import unicodedata, re

try:
    locale.setlocale(locale.LC_COLLATE, "ja_JP.UTF-8")
except Exception:
    pass

_ASCII = set(string.ascii_letters + string.digits)

def route_id_sort_key(s: str):
    """3-bucket sort: numeric → ASCII → locale-aware (Japanese)."""
    s = unicodedata.normalize("NFKC", (s or "")).strip()
    if re.fullmatch(r"[+-]?\d+", s):
        return (0, int(s))
    if all(c in _ASCII for c in s):
        return (1, s.lower())
    return (2, locale.strxfrm(s))
