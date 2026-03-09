# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import re


def digits(value) -> str:
    return re.sub(r"[^0-9]", "", str(value or ""))


def norm_csv_key(raw: str, pref_code: str) -> str:
    s = digits(raw)
    if pref_code == "37":  # Kagawa
        s = s[1:] if s.startswith("3") else s
    elif pref_code == "16":  # Toyama
        s = s[1:] if s.startswith("1") else s
    return s


def to_num(value):
    if value is None:
        return None
    s = str(value).strip().replace(",", "")
    return float(s) if s else None

