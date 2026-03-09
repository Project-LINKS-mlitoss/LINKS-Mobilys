# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
def normalize_project_id(raw):
    if raw is None:
        return None
    s = str(raw).strip()
    if s == "" or s.lower() in {"null", "none", "undefined"}:
        return None
    return s
