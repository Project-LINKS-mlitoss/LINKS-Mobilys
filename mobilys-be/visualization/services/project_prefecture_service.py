# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import List, Optional, Dict, Any

from data.prefecture_map import PREFECTURE_NAME_MAP
from visualization.models import ProjectPrefectureSelection, UserPrefectureSelection
from visualization.services.base import transactional


# Accept English input (case-insensitive)
_EN_TO_EN = {en.lower(): en for en in PREFECTURE_NAME_MAP.keys()}

# Accept Japanese input (case-insensitive)
_JP_TO_EN = {jp.lower(): en for en, jp in PREFECTURE_NAME_MAP.items() if jp}

# Combined lookup table
_ALLOWED_PREFECTURES = {**_EN_TO_EN, **_JP_TO_EN}

# Prefecture order (JIS prefecture-code order)
PREFECTURE_ORDER: List[str] = list(PREFECTURE_NAME_MAP.keys())


def normalize_prefecture_name(raw: Optional[str]) -> Optional[str]:
    """
    Normalize a prefecture name to its canonical English form.

    - Accepts English or Japanese input
    - Case-insensitive
    - Treats None / '' / 'default' as fallback (returns None)
    """
    if raw is None:
        return None

    value = str(raw).strip()
    if not value or value.lower() == "default":
        return None

    return _ALLOWED_PREFECTURES.get(value.lower())


def get_project_prefecture(project_id) -> Optional[str]:
    """
    Return the stored prefecture for the project (canonical English),
    or None if not set (meaning: fall back to scenario default).
    """
    if not project_id:
        return None

    selection = ProjectPrefectureSelection.objects.filter(
        project_id=project_id
    ).first()

    if not selection:
        return None

    pref = (selection.prefecture_name or "").strip()
    return pref or None


def get_user_prefecture(user_id) -> Optional[str]:
    """
    Return the stored prefecture for the user (canonical English),
    or None if not set.
    """
    if not user_id:
        return None

    selection = UserPrefectureSelection.objects.filter(user_id=user_id).first()
    if not selection:
        return None

    pref = (selection.prefecture_name or "").strip()
    return pref or None


@transactional
def set_project_prefecture(project_id, prefecture_name: Optional[str]) -> Optional[str]:
    """
    Persist the prefecture selection for a project.

    - Accepts English or Japanese input
    - Stores canonical English only
    - Passing None / 'default' clears selection (fallback mode)

    Returns:
        Canonical English prefecture name, or None if cleared
    """
    canonical = normalize_prefecture_name(prefecture_name)

    selection, _ = ProjectPrefectureSelection.objects.get_or_create(
        project_id=project_id,
        defaults={"prefecture_name": canonical},
    )

    if selection.prefecture_name != canonical:
        selection.prefecture_name = canonical
        selection.save(update_fields=["prefecture_name", "updated_at"])

    return canonical


@transactional
def set_user_prefecture(user_id, prefecture_name: Optional[str]) -> Optional[str]:
    """
    Persist the prefecture selection for a user.

    - Accepts English or Japanese input
    - Stores canonical English only
    - Passing None / 'default' clears selection (fallback mode)

    Returns:
        Canonical English prefecture name, or None if cleared
    """
    canonical = normalize_prefecture_name(prefecture_name)

    selection, _ = UserPrefectureSelection.objects.get_or_create(
        user_id=user_id,
        defaults={"prefecture_name": canonical},
    )

    if selection.prefecture_name != canonical:
        selection.prefecture_name = canonical
        selection.save(update_fields=["prefecture_name", "updated_at"])

    return canonical


def get_effective_prefectures(project_id, scenario_prefecture_info, *, user_id=None, return_status=False):
    """
    Resolve the prefecture list to use for spatial logic.

    Priority:
      1) Project-level selection (single canonical English name)
      2) User-level selection (single canonical English name)
      3) Scenario.prefecture_info fallback (list-like)

    If a project/user selection exists but does not appear in scenario_prefecture_info,
    returns an empty list and status "mismatch" (when return_status=True).

    Returns:
      - list[str] (default)
      - (list[str], status) when return_status=True
    """
    raw = scenario_prefecture_info or []
    scenario_names = [
        normalize_prefecture_name(p)
        for p in raw
        if isinstance(p, str) and str(p).strip()
    ]
    scenario_names = [n for n in scenario_names if n]
    scenario_set = set(scenario_names)

    def _result(names, status):
        return (names, status) if return_status else names

    project_pref = get_project_prefecture(project_id)
    if project_pref:
        if project_pref not in scenario_set:
            return _result([], "mismatch")
        return _result([project_pref], "project")

    user_pref = get_user_prefecture(user_id)
    if user_pref:
        if user_pref not in scenario_set:
            return _result([], "mismatch")
        return _result([user_pref], "user")

    if scenario_names:
        return _result(scenario_names, "scenario")

    return _result([], "none")


def allowed_prefectures() -> List[Dict[str, Any]]:
    """
    Return prefecture options for frontend selectors in JIS prefecture order.

    Each item:
      - key   : canonical English (used in API / backend)
      - label : Japanese display name
    """
    # Put known items in official order
    ordered: List[Dict[str, str]] = []
    seen = set()

    for en in PREFECTURE_ORDER:
        jp = PREFECTURE_NAME_MAP.get(en)
        if jp:
            ordered.append({"key": en, "label": jp})
            seen.add(en)

    leftovers = [en for en in PREFECTURE_NAME_MAP.keys() if en not in seen]
    for en in sorted(leftovers):
        ordered.append({"key": en, "label": PREFECTURE_NAME_MAP[en]})

    return ordered
