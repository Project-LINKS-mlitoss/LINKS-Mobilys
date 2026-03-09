# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import csv
import io
import logging
import re
from datetime import datetime
from datetime import date as dt_date
from typing import Any, Dict, List, Optional

from django.utils.dateparse import parse_date

from gtfs.models import Calendar, CalendarDates, Scenario, Trips

logger = logging.getLogger(__name__)

class CSVTemplateError(Exception):
    pass

class SimulationDoesntHaveDifferentError(Exception):
    pass

def _validate_ic_csv_file(uploaded_file) -> None:
    if not uploaded_file:
        return

    uploaded_file.seek(0)
    raw_bytes = uploaded_file.read()
    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw_bytes.decode("utf-8", errors="strict")

    sio = io.StringIO(text)
    reader = csv.DictReader(sio)
    required = [
        "date", "agency_id", "route_id", "trip_id",
        "stop_id", "stop_sequence", "count_geton", "count_getoff",
    ]

    fieldnames = [fn.strip() for fn in (reader.fieldnames or [])]
    lower_map = {fn.lower(): fn for fn in fieldnames}
    missing = [col for col in required if col not in lower_map]
    if missing:
        raise CSVTemplateError(
            "CSV の列名が不正です。必要な列: "
            + ",".join(required)
            + f"。不足: {','.join(missing)}"
        )

    errors: List[str] = []
    row_count = 0

    def gv(row, key):
        # support mixed-case header
        return (row.get(lower_map[key]) or "").strip()

    date_re = re.compile(r"^\d{8}$") 

    for idx, row in enumerate(reader, start=2):  
        row_count += 1

        v_date = gv(row, "date")
        if not date_re.match(v_date):
            errors.append(f"{idx}行目: date は YYYYMMDD (8桁) で指定してください。")

        v_agency = gv(row, "agency_id")
        if not v_agency:
            errors.append(f"{idx}行目: agency_id は必須です。")

        v_route = gv(row, "route_id")
        if not v_route:
            errors.append(f"{idx}行目: route_id は必須です。")

        v_trip = gv(row, "trip_id")
        if not v_trip:
            errors.append(f"{idx}行目: trip_id は必須です。")

        v_stop_id = gv(row, "stop_id")
        if not v_stop_id:
            errors.append(f"{idx}行目: stop_id は必須です。")

        # stop_sequence: int >= 1
        v_seq = gv(row, "stop_sequence")
        try:
            seq = int(v_seq)
            if seq < 1:
                errors.append(f"{idx}行目: stop_sequence は 1 以上の整数である必要があります。")
        except ValueError:
            errors.append(f"{idx}行目: stop_sequence は整数である必要があります。")

        # counts: int >= 0
        for cnt_key, jp_label in (("count_geton", "count_geton"), ("count_getoff", "count_getoff")):
            v_cnt = gv(row, cnt_key)
            try:
                cnt = int(v_cnt)
                if cnt < 0:
                    errors.append(f"{idx}行目: {jp_label} は 0 以上の整数である必要があります。")
            except ValueError:
                errors.append(f"{idx}行目: {jp_label} は整数である必要があります。")


    if row_count == 0:
        raise CSVTemplateError("CSV にデータ行がありません。")

    if errors:
        raise CSVTemplateError("CSV の内容が不正です")

    uploaded_file.seek(0)


def _get_scenario_obj(scenario: Any) -> Optional[Scenario]:
    if isinstance(scenario, Scenario):
        return scenario
    try:
        return Scenario.objects.get(pk=scenario)
    except Scenario.DoesNotExist:
        return None

def _build_ic_agg_from_csv(infile, *, scenario: Any) -> dict:
    sc = _get_scenario_obj(scenario)
    if not sc:
        logger.error("Scenario not found; returning empty.")
        return {}

    if not infile:
        return {}

    # --- read text (multi-encoding) ---
    try:
        raw = infile.read()
        if isinstance(raw, bytes):
            text = None
            for enc in ("utf-8-sig", "utf-8", "cp932", "shift_jis", "euc_jp"):
                try:
                    text = raw.decode(enc)
                    break
                except Exception:
                    continue
            if text is None:
                text = raw.decode("latin1", errors="ignore")
        else:
            text = raw
    except Exception:
        logger.exception("Reading uploaded file failed; returning empty.")
        return {}

    f = io.StringIO(text)
    try:
        reader = csv.DictReader(f)
    except Exception:
        logger.exception("CSV header parsing failed; returning empty.")
        return {}

    rows_tmp: List[tuple[dt_date, str, str, float]] = []
    trip_ids_set: set[str] = set()
    trip_getons: Dict[str, Dict[str, Dict[str, float]]] = {}
    for row in reader:
        try:
            date_str = (row.get("date") or "").strip()
            route_csv = (row.get("route_id") or "").strip()
            trip_id   = (row.get("trip_id") or "").strip()
            geton     = float(row.get("count_geton") or 0)
            if not date_str or not trip_id or not route_csv:
                continue
            d = _parse_date_flexible(date_str)
            if not d:
                continue
            if hasattr(d, "date"):
                d = d.date()
            rows_tmp.append((d, route_csv, trip_id, geton))
            trip_ids_set.add(trip_id)
        except Exception:
            continue

    if not rows_tmp:
        return {}

    trip_sid_map: Dict[str, str] = {}
    CHUNK = 100000
    trip_ids_list = list(trip_ids_set)
    for i in range(0, len(trip_ids_list), CHUNK):
        chunk = trip_ids_list[i:i+CHUNK]
        for t in Trips.objects.filter(scenario=sc, trip_id__in=chunk).values("trip_id", "service_id"):
            tid = t["trip_id"]
            sid = (t["service_id"] or "").strip()
            if tid and sid:
                trip_sid_map[tid] = sid

    dates_seen: set[dt_date] = {d for d, *_ in rows_tmp}
    active_by_date: Dict[dt_date, set[str]] = {d: set() for d in dates_seen}

    calendars = Calendar.objects.filter(scenario=sc)
    for cal in calendars:
        for d in dates_seen:
            if cal.start_date <= d <= cal.end_date:
                flags = [cal.monday, cal.tuesday, cal.wednesday, cal.thursday, cal.friday, cal.saturday, cal.sunday]
                if flags[d.weekday()]:
                    active_by_date[d].add(cal.service_id)

    cdates = CalendarDates.objects.filter(scenario=sc, date__in=list(dates_seen))
    for ex in cdates:
        if ex.exception_type == 1:
            active_by_date.setdefault(ex.date, set()).add(ex.service_id)
        elif ex.exception_type == 2:
            active_by_date.setdefault(ex.date, set()).discard(ex.service_id)

    by_date: Dict[dt_date, Dict[str, Dict[str, float]]] = {}
    for (d, route_csv, trip_id, geton) in rows_tmp:
        sid = trip_sid_map.get(trip_id)
        if not sid:
            continue
        if sid not in (active_by_date.get(d) or set()):
            continue

        bucket_d = by_date.setdefault(d, {})
        bucket_sid = bucket_d.setdefault(sid, {})
        bucket_sid[route_csv] = round(bucket_sid.get(route_csv, 0.0) + float(geton), 3)

        trip_map_for_service = trip_getons.setdefault(sid, {})
        trip_map_for_route = trip_map_for_service.setdefault(route_csv, {})
        trip_map_for_route[trip_id] = trip_map_for_route.get(trip_id, 0.0) + float(geton)

    if not by_date:
        return {}

    flat_by_service: Dict[str, Dict[str, float]] = {}
    for d, per_sid in by_date.items():
        for sid, per_route in per_sid.items():
            dst = flat_by_service.setdefault(sid, {})
            for rid, val in per_route.items():
                dst[rid] = round(dst.get(rid, 0.0) + float(val), 3)

    out: Dict[str, Any] = dict(flat_by_service)            
    out["__by_date__"] = {d.isoformat(): per_sid for d, per_sid in sorted(by_date.items())}
    trip_selection: Dict[str, Dict[str, str]] = {}
    for sid, per_route in trip_getons.items():
        if not per_route:
            continue
        trip_selection[sid] = {}
        for rid, trip_totals in per_route.items():
            if not trip_totals:
                continue
            best_trip = max(trip_totals.items(), key=lambda kv: kv[1])[0]
            trip_selection[sid][rid] = best_trip
    out["__trip_selection__"] = trip_selection
    return out

def _parse_date_flexible(s: str):
    if not s:
        return None
    s = s.strip()
    if len(s) == 8 and s.isdigit():
        try:
            return datetime.strptime(s, "%Y%m%d").date()
        except ValueError:
            return None
    return parse_date(s)


def _get_field(data, keys, required=False):
    if isinstance(keys, str):
        keys = [keys]
    for k in keys:
        if k in data and data[k] is not None:
            v = str(data[k]).strip()
            if v != "":
                return v
    if required:
        raise ValueError(f"missing:{'/'.join(keys)}")
    return None



def _req_float_form(data, keys, label: str):
    v = _get_field(data, keys, required=True)
    try:
        return float(v)
    except (TypeError, ValueError):
        raise ValueError(f"invalid_float:{label}")
