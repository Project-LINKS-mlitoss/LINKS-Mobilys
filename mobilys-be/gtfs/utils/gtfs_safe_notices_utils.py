# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Set, Any, Iterable

import logging

logger = logging.getLogger(__name__)

from time import monotonic

_registry_instance: Optional[SafeNoticeRegistry] = None
_registry_loaded_at: float = 0.0
_REGISTRY_TTL_SECONDS = 30.0  

@dataclass(frozen=True)
class SafeNoticeRule:
    code: str
    reason_ja: str
    reason_en: str
    sample_conditions: Optional[dict[str, Any]] = None
    allowed_filenames: Optional[frozenset[str]] = None
    skip: bool = False
    is_fixable: bool = False

    def matches(self, notice: dict) -> bool:
        if notice.get("code") != self.code:
            return False

        if not self.sample_conditions and not self.allowed_filenames:
            return True

        sample_notices = notice.get("sampleNotices", [])
        if not sample_notices:
            return False

        if self.allowed_filenames:
            for sample in sample_notices:
                filename = sample.get("filename", "")
                if filename not in self.allowed_filenames:
                    return False
            return True

        if self.sample_conditions:
            for sample in sample_notices:
                for field, expected_value in self.sample_conditions.items():
                    if sample.get(field) != expected_value:
                        return False
            return True

        return False


class SafeNoticeRegistry:
    def __init__(self, rules: Iterable[SafeNoticeRule]):
        self._rules_by_code: dict[str, list[SafeNoticeRule]] = {}
        for rule in rules:
            self._rules_by_code.setdefault(rule.code, []).append(rule)

    def is_safe_notice(self, notice: dict) -> tuple[bool, Optional[SafeNoticeRule]]:
        code = notice.get("code", "")
        rules = self._rules_by_code.get(code, [])
        for rule in rules:
            if rule.is_fixable:
                continue
            if rule.matches(notice):
                return True, rule
        return False, None

    def is_fixable_code(self, code: str) -> bool:
        rules = self._rules_by_code.get(code, [])
        return any(r.is_fixable for r in rules)

    def is_fixable_notice(self, notice: dict) -> tuple[bool, Optional[SafeNoticeRule]]:
        code = notice.get("code", "")
        rules = self._rules_by_code.get(code, [])
        for rule in rules:
            if not rule.is_fixable:
                continue
            if rule.matches(notice):
                return True, rule
        return False, None

    def get_splittable_rule(self, code: str) -> Optional[SafeNoticeRule]:
        rules = self._rules_by_code.get(code, [])
        for rule in rules:
            if rule.is_fixable:
                continue
            if rule.allowed_filenames:
                return rule
        return None

    def get_all_safe_codes(self) -> Set[str]:
        return {code for code, rules in self._rules_by_code.items() if any(not r.is_fixable for r in rules)}


def _built_in_rules() -> tuple[SafeNoticeRule, ...]:
    return ()


def _load_rules_from_db() -> Optional[tuple[SafeNoticeRule, ...]]:
    try:
        from django.core.cache import cache
        from django.db.models import Max
        from ..models import GtfsSafeNoticeRule as DbRule
    except Exception:
        return None

    qs = DbRule.objects.filter(is_active=True)

    stamp = qs.aggregate(m=Max("updated_at"))["m"]
    if stamp is None:
        return None

    cache_key = f"gtfs:safe_notice_rules:v1:{stamp.isoformat()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    rules: list[SafeNoticeRule] = []
    for r in qs.only(
        "code",
        "reason_ja",
        "reason_en",
        "sample_conditions",
        "allowed_filenames",
        "skip",
        "is_fixable",
    ).iterator():
        rules.append(
            SafeNoticeRule(
                code=r.code,
                reason_ja=r.reason_ja,
                reason_en=r.reason_en,
                sample_conditions=r.sample_conditions or None,
                allowed_filenames=frozenset(r.allowed_filenames) if r.allowed_filenames else None,
                skip=r.skip,
                is_fixable=r.is_fixable,
            )
        )

    result = tuple(rules)
    cache.set(cache_key, result, timeout=600)
    return result


_registry_instance: Optional[SafeNoticeRegistry] = None


def get_safe_notice_registry() -> SafeNoticeRegistry:
    """
    Singleton registry (DB-first, fallback to hardcoded) with TTL refresh.
    """
    global _registry_instance, _registry_loaded_at

    now = monotonic()
    if _registry_instance is not None and (now - _registry_loaded_at) < _REGISTRY_TTL_SECONDS:
        return _registry_instance

    rules = _load_rules_from_db() or _built_in_rules()
    _registry_instance = SafeNoticeRegistry(rules)
    _registry_loaded_at = now
    return _registry_instance


def reset_safe_notice_registry_cache() -> None:
    """
    Call this after admin updates rules if you want immediate effect
    without waiting cache TTL.
    """
    global _registry_instance
    _registry_instance = None
