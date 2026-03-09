# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# gtfs/utils/translation_utils.py
from typing import Dict, List, Tuple
from django.db import transaction
from gtfs.models import Translation

# Which entity IDs must be present for each table
ENTITY_KEYS_BY_TABLE = {
    "routes":      ["route_id"],
    "trips":       ["trip_id"],
    "stop_times":  ["trip_id", "stop_id"],
    "stops":       ["stop_id"],
    "shapes":      ["shape_id"],
    "feed_info":   ["feed_info_id"],
}

def _norm(s: str | None) -> str:
    return (s or "").strip()

@transaction.atomic
def upsert_translations(
    *,
    scenario_id: str,
    table_name: str,
    entity_ids: Dict[str, str],
    items: List[Dict],
) -> Tuple[int, int]:
    """
    Upsert translations under the unique key:
      (scenario_id, table_name, field_name, language,
       record_id, record_sub_id, field_value,
       route_id, trip_id, service_id, stop_id, shape_id, feed_info_id)

    items:      [{field_name, language, translation, field_value?, record_id?, record_sub_id?}, ...]
    entity_ids: subset of {route_id, trip_id, service_id, stop_id, shape_id, feed_info_id}
    """
    created = 0
    updated = 0

    table = _norm(table_name).lower()

    # Normalize all possible entity columns
    e = {
        "route_id":     _norm(entity_ids.get("route_id")),
        "trip_id":      _norm(entity_ids.get("trip_id")),
        "service_id":   _norm(entity_ids.get("service_id")),
        "stop_id":      _norm(entity_ids.get("stop_id")),
        "shape_id":     _norm(entity_ids.get("shape_id")),
        "feed_info_id": _norm(entity_ids.get("feed_info_id")),
    }

    # Enforce required entity keys for this table (prevents blank-key collisions)
    required_keys = ENTITY_KEYS_BY_TABLE.get(table, [])
    if any(not e[k] for k in required_keys):
        # Missing a required entity ID (e.g. stop_id for 'stops') -> nothing to do
        return 0, 0

    for it in (items or []):
        tid = it.get("id")

        fname = _norm(it.get("field_name"))
        fvalue = it.get("field_value") or ""
        lang = _norm(it.get("language"))
        trans = _norm(it.get("translation"))
        # Prefer explicit record_id/record_sub_id from payload; otherwise derive from entity IDs per table
        rec_id = _norm(it.get("record_id"))
        rec_sub_id = _norm(it.get("record_sub_id"))

        if not rec_id:
            if table == "routes":
                rec_id = e["route_id"]
            elif table == "trips":
                rec_id = e["trip_id"]
            elif table == "stops":
                rec_id = e["stop_id"]
            elif table == "stop_times":
                rec_id = e["trip_id"]
            elif table == "shapes":
                rec_id = e["shape_id"]
            elif table in ("calendar", "calendar_dates"):
                rec_id = e["service_id"]
            elif table == "feed_info":
                rec_id = e["feed_info_id"]
            # Fallback: use any provided entity id (in priority order)
            if not rec_id:
                for key in ("route_id", "trip_id", "service_id", "stop_id", "shape_id", "feed_info_id"):
                    if e.get(key):
                        rec_id = e[key]
                        break

        if not rec_sub_id and table == "stop_times":
            rec_sub_id = e["stop_id"]

        if tid:
            obj = (
                Translation.objects.filter(id = tid, scenario_id = scenario_id).first()
            )
            if obj:
                new_field_name = fname
                new_field_value = fvalue
                new_language = lang
                new_translation = trans
                # Only update record_id if the existing record already has one.
                new_record_id = rec_id if obj.record_id else ""
                new_record_sub_id = rec_sub_id
                table_for_update = (obj.table_name or table)

                dup_exists = Translation.objects.filter(
                    scenario_id = scenario_id,
                    table_name = table_for_update,
                    field_name = new_field_name,
                    field_value = new_field_value,
                    language = new_language,
                    translation = new_translation,
                    record_id = new_record_id or obj.record_id,
                    record_sub_id = new_record_sub_id or obj.record_sub_id,
                    route_id = obj.route_id,
                    trip_id = obj.trip_id,
                    service_id = obj.service_id,
                    stop_id = obj.stop_id,
                    shape_id = obj.shape_id,
                    feed_info_id = obj.feed_info_id,

                ).exclude(id = obj.id).exists()
                if dup_exists:
                    obj.delete()
                    updated += 1
                    continue


                changed = False
                if new_field_name and obj.field_name != new_field_name:
                    obj.field_name = new_field_name; changed = True
                if obj.field_value != new_field_value:
                    obj.field_value = new_field_value; changed = True
                if new_record_id and obj.record_id != new_record_id:
                    obj.record_id = new_record_id; changed = True
                if new_record_sub_id and obj.record_sub_id != new_record_sub_id:
                    obj.record_sub_id = new_record_sub_id; changed = True
                if new_language and obj.language != new_language:
                    obj.language = new_language; changed = True
                if obj.translation != new_translation:
                    obj.translation = new_translation; changed = True
                if changed:
                    fields_to_update = ["field_name", "field_value", "language", "translation"]
                    if new_record_id:
                        fields_to_update.append("record_id")
                    if new_record_sub_id:
                        fields_to_update.append("record_sub_id")
                    obj.save(update_fields=fields_to_update)  # +

                updated += 1
                continue

        dupes_qs = Translation.objects.filter(
            scenario_id = scenario_id,
            table_name = table,
            field_name = fname,
            field_value = fvalue,
            language = lang,
            translation = trans,
            record_id = rec_id,
            record_sub_id = rec_sub_id,
            route_id = e["route_id"],
            trip_id = e["trip_id"],
            service_id = e["service_id"],
            stop_id = e["stop_id"],
            shape_id = e["shape_id"],
            feed_info_id = e["feed_info_id"],
        )
        if dupes_qs.exists():
            ids = list(dupes_qs.order_by("id").values_list("id", flat = True))
            if len(ids) > 1:
                Translation.objects.filter(id__in = ids[1:]).delete()
                updated += (len(ids) -1)
            continue
        
        Translation.objects.create(
            scenario_id = scenario_id,
            table_name = table,
            field_name = fname,
            language = lang,
            translation = trans,
            field_value = fvalue,
            record_id = rec_id,
            record_sub_id = rec_sub_id,
            **e
        )
        created += 1

    return created, updated
