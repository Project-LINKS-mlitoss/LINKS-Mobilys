from collections import defaultdict
from datetime import datetime

from gtfs.models import StopIdKeyword, StopIdKeywordMap, StopNameKeywords, StopNameKeywordMap
from visualization.constants.values import DATE_ALL_LABEL, DATE_FMTS
from visualization.constants.messages import Messages


def is_valid_date(v) -> bool:
    if v is None or (isinstance(v, str) and not v.strip()):
        return False
    s = str(v).strip()
    for f in DATE_FMTS:
        try:
            datetime.strptime(s, f)
            return True
        except ValueError:
            continue
    return False


def is_nonneg_int(v) -> bool:
    if v is None:
        return False
    try:
        return int(v) >= 0
    except (TypeError, ValueError):
        return False


def _validate_row(row: dict, idx: int) -> dict | None:
    errors = {}
    if not _is_valid_date_strict(row.get("date")):
        errors["date"] = Messages.OD_DATE_INVALID_FORMAT_EN
    if not (row.get("route_id") and str(row.get("route_id")).strip()):
        errors["route_id"] = Messages.OD_ROUTE_ID_MISSING_EN
    if not (row.get("stopid_geton") and str(row.get("stopid_geton")).strip()):
        errors["stopid_geton"] = Messages.OD_STOPID_GETON_MISSING_EN
    if not (row.get("stopid_getoff") and str(row.get("stopid_getoff")).strip()):
        errors["stopid_getoff"] = Messages.OD_STOPID_GETOFF_MISSING_EN
    if not is_nonneg_int(row.get("count")):
        errors["count"] = Messages.OD_COUNT_NONNEG_INT_EN
    if errors:
        return {"row_index": idx, "errors": errors, "row": row}
    return None


def _validate_row_upload(row: dict, idx: int) -> dict | None:
    errors = {}
    if not _is_valid_date_strict(row.get("date")):
        errors["date"] = Messages.OD_UPLOAD_DATE_INVALID_JA
    if not (row.get("route_id") and str(row.get("route_id")).strip()):
        errors["route_id"] = Messages.OD_UPLOAD_ROUTE_ID_REQUIRED_JA
    if not (row.get("stopid_geton") and str(row.get("stopid_geton")).strip()):
        errors["stopid_geton"] = Messages.OD_UPLOAD_STOPID_GETON_REQUIRED_JA
    if not (row.get("stopid_getoff") and str(row.get("stopid_getoff")).strip()):
        errors["stopid_getoff"] = Messages.OD_UPLOAD_STOPID_GETOFF_REQUIRED_JA
    if not is_nonneg_int(row.get("count")):
        errors["count"] = Messages.OD_UPLOAD_COUNT_NONNEG_INT_JA
    if errors:
        return {"row_index": idx, "errors": errors, "row": row}
    return None


def _is_valid_date_strict(v) -> bool:
    if not v or not isinstance(v, str) or not v.strip():
        return False
    s = v.strip()
    for f in DATE_FMTS:
        try:
            datetime.strptime(s, f)
            return True
        except ValueError:
            continue
    return False


def split_valid_invalid(od_data: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, invalid = [], []
    for i, row in enumerate(od_data or []):
        bad = _validate_row(row, i)
        if bad:
            invalid.append(bad)
        else:
            valid.append(row)
    return valid, invalid


def split_valid_invalid_usage(od_data: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, invalid = [], []
    for i, row in enumerate(od_data or []):
        errors = {}
        if not is_valid_date(row.get("date")):
            errors["date"] = Messages.OD_DATE_INVALID_FORMAT_EN
        if not (row.get("route_id") and str(row.get("route_id")).strip()):
            errors["route_id"] = Messages.OD_ROUTE_ID_MISSING_EN
        if not (row.get("stopid_geton") and str(row.get("stopid_geton")).strip()):
            errors["stopid_geton"] = Messages.OD_STOPID_GETON_MISSING_EN
        if not (row.get("stopid_getoff") and str(row.get("stopid_getoff")).strip()):
            errors["stopid_getoff"] = Messages.OD_STOPID_GETOFF_MISSING_EN
        if not is_nonneg_int(row.get("count")):
            errors["count"] = Messages.OD_COUNT_NONNEG_INT_EN
        if errors:
            invalid.append({"row_index": i, "errors": errors, "row": row})
        else:
            valid.append(row)
    return valid, invalid


def split_valid_invalid_upload(od_data: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, invalid = [], []
    for i, row in enumerate(od_data or []):
        bad = _validate_row_upload(row, i)
        if bad:
            invalid.append(bad)
        else:
            valid.append(row)
    return valid, invalid


def build_stop_name_group_maps(scenario_id):
    """
    Build stop-name grouping lookups for a scenario.

    Parameters:
    - scenario_id (str): Scenario identifier.

    Returns:
    - tuple: (stop_keywords, group_to_keyword, stopid_to_groups, group_to_stopids_set).
    """
    stop_keywords = list(StopNameKeywords.objects.filter(scenario_id=scenario_id))
    group_to_keyword = {str(kw.stop_group_id): kw for kw in stop_keywords}

    stopid_to_groups = defaultdict(set)
    group_to_stopids = defaultdict(list)
    for m in StopNameKeywordMap.objects.filter(scenario_id=scenario_id):
        gid = str(m.stop_name_group_id)
        stopid_to_groups[m.stop_id].add(gid)
        group_to_stopids[gid].append(m.stop_id)

    group_to_stopids_set = {gid: set(sids) for gid, sids in group_to_stopids.items()}
    return stop_keywords, group_to_keyword, stopid_to_groups, group_to_stopids_set


def build_stop_id_group_maps(scenario_id):
    """
    Build stop-id grouping lookups for a scenario.

    Parameters:
    - scenario_id (str): Scenario identifier.

    Returns:
    - tuple: (stop_keywords, group_to_keyword, stopid_to_groups, group_to_stopids_set).
    """
    stop_keywords = list(StopIdKeyword.objects.filter(scenario_id=scenario_id))
    group_to_keyword = {kw.stop_group_id: kw for kw in stop_keywords}

    stopid_to_groups = defaultdict(set)
    group_to_stopids = defaultdict(list)
    for m in StopIdKeywordMap.objects.filter(scenario_id=scenario_id):
        gid = m.stop_id_group_id
        stopid_to_groups[m.stop_id].add(gid)
        group_to_stopids[gid].append(m.stop_id)

    group_to_stopids_set = {gid: set(sids) for gid, sids in group_to_stopids.items()}
    return stop_keywords, group_to_keyword, stopid_to_groups, group_to_stopids_set


def build_stop_name_group_details(scenario_id):
    """
    Build stop-name grouping details for parent stop lookup.

    Parameters:
    - scenario_id (str): Scenario identifier.

    Returns:
    - tuple: (stopid_to_group, stop_groups).
    """
    stopid_to_group = {}
    for m in StopNameKeywordMap.objects.filter(scenario_id=scenario_id):
        stopid_to_group[m.stop_id] = m.stop_name_group_id

    stop_groups = {}
    for kw in StopNameKeywords.objects.filter(scenario_id=scenario_id):
        stop_groups[str(kw.stop_group_id)] = {
            "stop_group_id": str(kw.stop_group_id),
            "stop_keyword": kw.stop_name_keyword,
            "stop_long": kw.stop_names_long,
            "stop_lat": kw.stop_names_lat,
        }

    return stopid_to_group, stop_groups


def build_stop_id_group_details(scenario_id):
    """
    Build stop-id grouping details for parent stop lookup.

    Parameters:
    - scenario_id (str): Scenario identifier.

    Returns:
    - tuple: (stopid_to_group, stop_groups).
    """
    stopid_to_group = {}
    for m in StopIdKeywordMap.objects.filter(scenario_id=scenario_id):
        stopid_to_group[m.stop_id] = m.stop_id_group_id

    stop_groups = {}
    for kw in StopIdKeyword.objects.filter(scenario_id=scenario_id):
        stop_groups[str(kw.stop_group_id)] = {
            "stop_group_id": str(kw.stop_group_id),
            "stop_keyword": kw.stop_id_keyword,
            "stop_long": kw.stop_id_long,
            "stop_lat": kw.stop_id_lat,
        }

    return stopid_to_group, stop_groups
