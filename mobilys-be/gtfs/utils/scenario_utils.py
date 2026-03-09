# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Q
from collections import Counter
from gtfs.utils.route_data_utils import RouteDataUtils
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

import io
import csv
import zipfile
from decimal import Decimal
from datetime import time
from ..models import (
    Scenario,
    Agency, AgencyJP, OfficeJP, PatternJP,
    Stops, Routes, Shape, Trips, StopTimes,
    Calendar, CalendarDates, FeedInfo, Translation,
    FareAttribute, FareRule,
    Frequencies, Transfers, Pathway, Level,
    LocationGroup, LocationGroupStop,
    BookingRule, Attribution,
    StopNameKeywords, StopNameKeywordMap,
    StopIdKeyword, StopIdKeywordMap,
    RouteKeywords, RouteKeywordMap,
    GtfsImportedFile, GtfsImportedField,
    Timeframe, RiderCategory,
    FareMedia, FareProduct,
    FareLegRule, FareLegJoinRule, FareTransferRule,
    Area, StopArea,
    Network, RouteNetwork,
)
from user.models import ProjectUserMap
import io
import zipfile
import csv
from django.utils.dateparse import parse_date
from visualization.utils.road_network_reachability_utils import get_region_and_prefectures_by_scenario
from gtfs.constants import ScenarioEditState, SourceType


def _time_to_gtfs_string(time_obj, is_next_day):
    """
    Convert Python time object back to GTFS time string format.
    If is_next_day is True, add 24 hours to the time.
    
    Examples:
        time(0, 30, 0), True  -> "24:30:00"
        time(1, 30, 0), True  -> "25:30:00"
        time(8, 30, 0), False -> "08:30:00"
        time(23, 59, 59), False -> "23:59:59"
    """
    if time_obj is None:
        return ""
    
    hours = time_obj.hour
    minutes = time_obj.minute
    seconds = time_obj.second
    
    # If next day flag is true, add 24 hours
    if is_next_day:
        hours += 24
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def clone_queryset(model, source_scenario, new_scenario, fk_field='scenario', remap_fields=None):
    now = timezone.now()
    records = model.objects.filter(**{fk_field: source_scenario})
    clones = []

    for record in records:
        record.pk = None
        setattr(record, fk_field, new_scenario)

        if remap_fields:
            for field, mapping in remap_fields.items():
                old_value = getattr(record, field)
                if old_value in mapping:
                    setattr(record, field, mapping[old_value])

        # Set created/updated timestamps if present
        if hasattr(record, "created_datetime"):
            record.created_datetime = now
        if hasattr(record, "updated_datetime"):
            record.updated_datetime = now

        clones.append(record)

    if clones:
        model.objects.bulk_create(clones)
    return clones


def clone_scenario_models(user, source_scenario_id, new_scenario_name):
    with transaction.atomic():
        source = Scenario.objects.get(id=source_scenario_id)

        # Create new scenario
        now = timezone.now()
        new_scenario = Scenario.objects.create(
            user=user,
            scenario_name=new_scenario_name,
            gtfs_filename=source.gtfs_filename,
            source_type=SourceType.CLONED_FILE.value,
            source_scenario=source,
            stops_grouping_method=source.stops_grouping_method,
            start_date=source.start_date,
            end_date=source.end_date,
            created_datetime=now,
            updated_datetime=now
        )

        # Clone all base models
        clone_queryset(Agency, source, new_scenario)
        clone_queryset(AgencyJP, source, new_scenario)
        clone_queryset(OfficeJP, source, new_scenario)
        clone_queryset(PatternJP, source, new_scenario)

        clone_queryset(Stops, source, new_scenario)
        clone_queryset(Routes, source, new_scenario)
        clone_queryset(Shape, source, new_scenario)
        clone_queryset(Calendar, source, new_scenario)
        clone_queryset(StopNameKeywords, source, new_scenario)
        clone_queryset(RouteKeywords, source, new_scenario)
        clone_queryset(StopIdKeyword, source, new_scenario)
        clone_queryset(Trips, source, new_scenario)
        clone_queryset(CalendarDates, source, new_scenario)
        clone_queryset(StopTimes, source, new_scenario)
        clone_queryset(FeedInfo, source, new_scenario)
        clone_queryset(Translation, source, new_scenario)

        # New GTFS global / flex / JP tables
        clone_queryset(Frequencies, source, new_scenario)
        clone_queryset(Transfers, source, new_scenario)
        clone_queryset(Pathway, source, new_scenario)
        clone_queryset(Level, source, new_scenario)
        clone_queryset(BookingRule, source, new_scenario)
        clone_queryset(Attribution, source, new_scenario)

        # Location groups need FK remap for LocationGroupStop
        clone_queryset(LocationGroup, source, new_scenario)
        old_lg = list(LocationGroup.objects.filter(scenario=source))
        new_lg = list(LocationGroup.objects.filter(scenario=new_scenario))
        lg_by_key = { (g.location_group_id): g for g in new_lg }
        lg_id_map = {}
        for old in old_lg:
            new = lg_by_key.get(old.location_group_id)
            if new:
                lg_id_map[old.id] = new.id

        clone_queryset(
            LocationGroupStop,
            source,
            new_scenario,
            remap_fields={
                "location_group_id": lg_id_map,  # use FK raw id field
            },
        )

        # --- SCRUM-664: Update FeedInfo.version to append scenario name ---
        old_feed_infos = list(
            FeedInfo.objects.filter(scenario=source).order_by("id")
        )
        new_feed_infos = list(
            FeedInfo.objects.filter(scenario=new_scenario).order_by("id")
        )

        for old, new in zip(old_feed_infos, new_feed_infos):
            old_version = (old.feed_version or "").strip()
            if old_version:
                new.feed_version = f"{old_version}_{new_scenario.scenario_name}"
            else:
                new.feed_version = new_scenario.scenario_name

        if new_feed_infos:
            FeedInfo.objects.bulk_update(new_feed_infos, ["feed_version"])
        # --- END NEW ---

        # Build keyword mapping for routes and stops
        old_keywords = list(RouteKeywords.objects.filter(scenario=source).order_by('keyword'))
        new_keywords = list(RouteKeywords.objects.filter(scenario=new_scenario).order_by('keyword'))
        route_keyword_map = {
            old.id: new.id
            for old, new in zip(old_keywords, new_keywords)
        }

        old_stop_name_keywords = list(StopNameKeywords.objects.filter(scenario=source).order_by('stop_name_keyword'))
        new_stop_name_keywords = list(StopNameKeywords.objects.filter(scenario=new_scenario).order_by('stop_name_keyword'))
        stop_name_keyword_map = {str(old.stop_group_id): str(new.stop_group_id) for old, new in zip(old_stop_name_keywords, new_stop_name_keywords)}

        old_stop_id_keywords = list(StopIdKeyword.objects.filter(scenario=source).order_by('stop_id_keyword'))
        new_stop_id_keywords = list(StopIdKeyword.objects.filter(scenario=new_scenario).order_by('stop_id_keyword'))
        stop_id_keyword_map = {old.stop_group_id: new.stop_group_id for old, new in zip(old_stop_id_keywords, new_stop_id_keywords)}

        # Clone keyword mapping table with remapping
        clone_queryset(RouteKeywordMap, source, new_scenario, remap_fields={
            'keyword_id': route_keyword_map
        })

        clone_queryset(StopNameKeywordMap, source, new_scenario, remap_fields={
            'stop_name_group_id': stop_name_keyword_map
        })

        clone_queryset(StopIdKeywordMap, source, new_scenario, remap_fields={
            'stop_id_group_id': stop_id_keyword_map
        })

        # Build mapping: old FareAttribute.id -> new FareAttribute.id (by fare_id)
        clone_queryset(FareAttribute, source, new_scenario)
        old_fares = list(
            FareAttribute.objects.filter(scenario=source).only("id", "fare_id")
        )
        new_fares = list(
            FareAttribute.objects.filter(scenario=new_scenario).only("id", "fare_id")
        )

        new_fare_by_code = {fa.fare_id: fa.id for fa in new_fares}

        fare_attr_id_map: dict[int, int] = {}
        for fa in old_fares:
            new_id = new_fare_by_code.get(fa.fare_id)
            if new_id is not None:
                fare_attr_id_map[fa.id] = new_id

        clone_queryset(
            FareRule,
            source,
            new_scenario,
            remap_fields={
                "fare_attribute_id": fare_attr_id_map,  
            },
        )

        # Clone imported files + fields (so export rules follow original import)
        clone_queryset(GtfsImportedFile, source, new_scenario)
        old_files = list(GtfsImportedFile.objects.filter(scenario=source))
        new_files = list(GtfsImportedFile.objects.filter(scenario=new_scenario))
        new_files_by_name = {gf.file_name: gf for gf in new_files}
        gf_id_map = {}
        for old in old_files:
            nf = new_files_by_name.get(old.file_name)
            if nf:
                gf_id_map[old.id] = nf.id

        # Clone imported fields (filter by scenario via gtfs_file FK)
        imported_fields = []
        for field in GtfsImportedField.objects.filter(gtfs_file__scenario=source):
            field.pk = None
            field.gtfs_file_id = gf_id_map.get(field.gtfs_file_id)
            if field.gtfs_file_id:
                imported_fields.append(field)
        if imported_fields:
            GtfsImportedField.objects.bulk_create(imported_fields)

    #update region and prefecture
    update_scenario_region_and_prefecture(new_scenario.id)

    return new_scenario


def generate_gtfs_zip(scenario_id):
    """
    Legacy helper: keep the old signature but delegate to the new
    generate_gtfs_zip_export which respects imported files/fields.
    """
    return generate_gtfs_zip_export(scenario_id)


def _validate_date_range(start_date, end_date):
    if start_date and end_date and end_date < start_date:
        raise ValidationError("最後日期は開始日より前にできません。")


def _upsert_feed_info(scenario, fi_payload):
    if fi_payload is None:
        return

    defaults = {
        "feed_publisher_name": fi_payload.get("publisher_name") or "",
        "feed_publisher_url": fi_payload.get("publisher_url") or "",
        "feed_lang": fi_payload.get("language") or "ja",
        "feed_start_date": fi_payload.get("start_date") or scenario.start_date,
        "feed_end_date": fi_payload.get("end_date") or scenario.end_date,
        "feed_version": fi_payload.get("version") or "",
        "default_lang": fi_payload.get("default_lang") or "",
        "feed_contact_email": fi_payload.get("feed_contact_email") or "",
        "feed_contact_url": fi_payload.get("feed_contact_url") or "",
    }

    feed_info = (
        FeedInfo.objects.filter(scenario=scenario)
        .order_by("id")
        .first()
    )

    if feed_info is None:
        FeedInfo.objects.create(scenario=scenario, **defaults)
        return

    field_map = {
        # Frontend keys
        "publisher_name": "feed_publisher_name",
        "publisher_url": "feed_publisher_url",
        "language": "feed_lang",
        "start_date": "feed_start_date",
        "end_date": "feed_end_date",
        "version": "feed_version",
        # Legacy keys
        "feed_publisher_name": "feed_publisher_name",
        "feed_publisher_url": "feed_publisher_url",
        "feed_lang": "feed_lang",
        "feed_start_date": "feed_start_date",
        "feed_end_date": "feed_end_date",
        "feed_version": "feed_version",
        # Optional extras
        "default_lang": "default_lang",
        "feed_contact_email": "feed_contact_email",
        "feed_contact_url": "feed_contact_url",
    }

    update_fields = []
    for payload_key, model_field in field_map.items():
        if payload_key in fi_payload:
            setattr(feed_info, model_field, fi_payload[payload_key])
            update_fields.append(model_field)
    if update_fields:
        # Deduplicate update fields to avoid duplicate entries if both key styles are present
        feed_info.save(update_fields=list(dict.fromkeys(update_fields)))


def _build_service_id_usage_message(scenario, service_ids):
    """
    If any of the given service_ids are referenced by Trips in this scenario,
    return a human-readable JP message describing the usage.
    Otherwise return None.
    """
    if not service_ids:
        return None

    scenario_id = scenario.id

    # Get trips using these service_ids
    trips = list(
        Trips.objects
        .filter(scenario_id=scenario_id, service_id__in=service_ids)
        .values("trip_id", "route_id", "direction_id", "service_id", "shape_id")
    )
    if not trips:
        return None

    trip_ids = [t["trip_id"] for t in trips]

    # Fetch first and last stop per trip
    stop_times = list(
        StopTimes.objects
        .filter(scenario_id=scenario_id, trip_id__in=trip_ids)
        .order_by("trip_id", "stop_sequence")
        .values("trip_id", "stop_id")
    )

    first_last_by_trip = {}
    for row in stop_times:
        tid = row["trip_id"]
        sid = row["stop_id"]
        if tid not in first_last_by_trip:
            first_last_by_trip[tid] = [sid, sid]
        else:
            first_last_by_trip[tid][1] = sid

    needed_stop_ids = set()
    for first_sid, last_sid in first_last_by_trip.values():
        if first_sid:
            needed_stop_ids.add(first_sid)
        if last_sid:
            needed_stop_ids.add(last_sid)

    stop_name_map = {
        s.stop_id: s.stop_name
        for s in Stops.objects.filter(scenario_id=scenario_id, stop_id__in=needed_stop_ids)
    }

    # Group by pattern (route_id, direction_id, service_id, shape_id)
    pattern_meta = {}
    pair_counter = {}

    for t in trips:
        key = (t["route_id"], t["direction_id"], t["service_id"], t["shape_id"])
        if key not in pattern_meta:
            pattern_id = RouteDataUtils.make_pattern_id(
                t["route_id"],
                t["shape_id"],
                t["direction_id"],
                t["service_id"],
            )
            pattern_meta[key] = {
                "pattern_id": pattern_id,
                "direction_id": t["direction_id"],
                "service_id": t["service_id"],
            }
            pair_counter[key] = Counter()

        bounds = first_last_by_trip.get(t["trip_id"])
        if bounds:
            first_name = stop_name_map.get(bounds[0], "")
            last_name = stop_name_map.get(bounds[1], "")
            pair = f"{first_name} - {last_name}" if (first_name or last_name) else ""
            if pair:
                pair_counter[key][pair] += 1

    lines = []
    used_service_ids = set()
    for key, meta in pattern_meta.items():
        pair = ""
        if pair_counter.get(key):
            pair = pair_counter[key].most_common(1)[0][0]
        used_service_ids.add(meta["service_id"])
        lines.append(
            f"- pattern_id: {meta['pattern_id']}, direction_id: {meta['direction_id']}, "
            f"service_id: {meta['service_id']}, first_and_last_stop_name: {pair}"
        )

    lines.sort()
    used_service_ids_text = ", ".join(sorted(str(sid) for sid in used_service_ids))

    header_lines = [
        "この運行カレンダーは以下の運行パターンで使用されているため削除できません。",
    ]
    if used_service_ids_text:
        header_lines.append(f"service_id: {used_service_ids_text}")
    header_lines.append("影響を受ける運行パターンの例：")

    msg = "\n".join(header_lines + lines)
    return msg


def _replace_calendar(scenario, calendar_rows):
    if calendar_rows is None:
        return False

    existing = {c.service_id: c for c in Calendar.objects.filter(scenario=scenario)}
    incoming_ids = set()

    touched = False

    # Upsert incoming rows
    for row in calendar_rows:
        sid = row["service_id"]
        incoming_ids.add(sid)

        obj = existing.get(sid) or Calendar(scenario=scenario, service_id=sid)
        fields = [
            "monday", "tuesday", "wednesday", "thursday",
            "friday", "saturday", "sunday", "start_date", "end_date",
        ]
        updated = False
        for f in fields:
            val = row[f]
            if getattr(obj, f, None) != val:
                setattr(obj, f, val)
                updated = True

        if obj.pk is None:
            obj.save()
            touched = True
        elif updated:
            obj.save(update_fields=fields + ["updated_datetime"])
            touched = True

    # Detect removed service_ids (candidate for deletion)
    removed_service_ids = [sid for sid in existing.keys() if sid not in incoming_ids]

    if removed_service_ids:
        # 1) Check usage in Trips – if used, block deletion
        usage_msg = _build_service_id_usage_message(scenario, removed_service_ids)
        if usage_msg:
            # Will be caught in ScenarioLocalViewSet._perform_update as DjangoValidationError
            raise ValidationError(usage_msg)

        # 2) Safe to delete: remove Calendar and related CalendarDates
        Calendar.objects.filter(scenario=scenario, service_id__in=removed_service_ids).delete()
        CalendarDates.objects.filter(scenario=scenario, service_id__in=removed_service_ids).delete()
        touched = True

    return touched


def _replace_calendar_dates(scenario, calendar_dates_rows):
    if calendar_dates_rows is None:
        return False

    # Only allow dates for existing service_ids in calendar
    allowed_service_ids = set(
        Calendar.objects.filter(scenario=scenario).values_list("service_id", flat=True)
    )
    filtered_rows = [
        r for r in calendar_dates_rows
        if r["service_id"] in allowed_service_ids
    ]

    # Build target set from filtered rows
    incoming_keys = {(r["service_id"], r["date"]) for r in filtered_rows}

    existing_qs = CalendarDates.objects.filter(scenario=scenario)
    existing_keys = set(existing_qs.values_list("service_id", "date"))

    # inserts / updates
    to_create = []
    to_update = []
    for r in filtered_rows:
        key = (r["service_id"], r["date"])
        if key in existing_keys:
            cd = existing_qs.get(service_id=r["service_id"], date=r["date"])
            if cd.exception_type != r["exception_type"]:
                cd.exception_type = r["exception_type"]
                to_update.append(cd)
        else:
            to_create.append(CalendarDates(
                scenario=scenario,
                service_id=r["service_id"],
                date=r["date"],
                exception_type=r["exception_type"],
            ))

    touched = False
    if to_create:
        CalendarDates.objects.bulk_create(to_create, batch_size=500)
        touched = True
    for cd in to_update:
        cd.save(update_fields=["exception_type", "updated_datetime"])
        touched = True

    # deletes (only among existing; including any that are not in filtered_rows)
    to_delete = existing_keys - incoming_keys
    if to_delete:
        dq = Q()
        for sid, d in to_delete:
            dq |= Q(service_id=sid, date=d)
        if dq:
            CalendarDates.objects.filter(scenario=scenario).filter(dq).delete()
            touched = True

    return touched


@transaction.atomic
def update_scenario_and_feed_and_calendar(
    scenario_id,
    user,                                   
    payload: dict,
    *,
    keep_calendar_if_only_date_change=False # If true: do not auto-update calendar when scenario dates change
):
    # lock scenario
    scenario = (
        Scenario.objects.select_for_update()
        .select_related()  
        .get(id=scenario_id)
    )

    # --- Scenario fields
    scenario_name = payload.get("scenario_name", scenario.scenario_name)
    start_date = payload.get("start_date", scenario.start_date)
    end_date   = payload.get("end_date", scenario.end_date)

    _validate_date_range(start_date, end_date)

    # track if dates changed
    start_changed = (start_date != scenario.start_date)
    end_changed   = (end_date != scenario.end_date)

    scenario.scenario_name = scenario_name
    scenario.start_date = start_date
    scenario.end_date = end_date
    scenario.updated_datetime = timezone.now()
    scenario.save(update_fields=["scenario_name","start_date","end_date","updated_datetime"])

    # --- FeedInfo
    _upsert_feed_info(scenario, payload.get("feed_info"))

    # --- Calendar & CalendarDates 
    cal_payload = payload.get("calendar", None)
    cdates_payload = payload.get("calendar_dates", None)

    # If FE doesnt send calendar but scenario dates changed
    if cal_payload is None and (start_changed or end_changed) and not keep_calendar_if_only_date_change:
        # Strategy: update all Calendar.start_date/end_date to match scenario
        cal_payload = [
            {
                "service_id": c.service_id,
                "monday": c.monday, "tuesday": c.tuesday, "wednesday": c.wednesday,
                "thursday": c.thursday, "friday": c.friday, "saturday": c.saturday, "sunday": c.sunday,
                "start_date": start_date, "end_date": end_date
            }
            for c in Calendar.objects.filter(scenario=scenario)
        ]
        

    cal_touched = _replace_calendar(scenario, cal_payload) if cal_payload is not None else False
    cdates_touched = _replace_calendar_dates(scenario, cdates_payload) if cdates_payload is not None else False

    feedinfo = getattr(scenario, "feedinfo", None) if hasattr(FeedInfo, "scenario") and FeedInfo._meta.get_field("scenario").one_to_one else \
               FeedInfo.objects.filter(scenario=scenario)

    return {
        "id": str(scenario.id),
        "gtfs_filename": scenario.gtfs_filename,
        "created_datetime": scenario.created_datetime,
        "updated_datetime": scenario.updated_datetime,
        "scenario_name": scenario.scenario_name,
        "source_type": scenario.get_source_type_display(),
        "start_date": scenario.start_date,
        "end_date": scenario.end_date,
        "osm_graph_status": scenario.osm_graph_status,
        "drm_graph_status": scenario.drm_graph_status,
    }


def update_scenario_edit_state(scenario_id, new_state):
    try:
        scenario = Scenario.objects.get(id=scenario_id)
        edited_data = scenario.edited_data or []
        if new_state not in edited_data:
            scenario.edit_state = ScenarioEditState.EDITED.value
            edited_data.append(new_state)
            scenario.edited_data = edited_data
            scenario.updated_datetime = timezone.now()
            scenario.save()
        return True
    except Scenario.DoesNotExist:
        return False


def generate_gtfs_zip_export(
    scenario_id,
    start_date=None,
    end_date=None,
    include_files=None,
):

    # 1) parse incoming dates
    if start_date and isinstance(start_date, str):
        start_date = parse_date(start_date)
    if end_date and isinstance(end_date, str):
        end_date = parse_date(end_date)

    # 2) map logical keys → (filename, queryset factory)
    table_map = {
        'agency': ('agency.txt', lambda: Agency.objects.filter(scenario_id=scenario_id)),
        'agency_jp': ('agency_jp.txt', lambda: AgencyJP.objects.filter(scenario_id=scenario_id)),
        'office_jp': ('office_jp.txt', lambda: OfficeJP.objects.filter(scenario_id=scenario_id)),
        'pattern_jp': ('pattern_jp.txt', lambda: PatternJP.objects.filter(scenario_id=scenario_id)),

        'stops': ('stops.txt', lambda: Stops.objects.filter(scenario_id=scenario_id)),
        'routes': ('routes.txt', lambda: Routes.objects.filter(scenario_id=scenario_id)),
        'trips': ('trips.txt', lambda: Trips.objects.filter(scenario_id=scenario_id)),
        'stop_times': ('stop_times.txt', lambda: StopTimes.objects.filter(scenario_id=scenario_id)),
        'calendar': ('calendar.txt', lambda: Calendar.objects.filter(scenario_id=scenario_id)),
        'calendar_dates': ('calendar_dates.txt', lambda: CalendarDates.objects.filter(scenario_id=scenario_id)),
        'shapes': ('shapes.txt', lambda: Shape.objects.filter(scenario_id=scenario_id)),
        'frequencies': ('frequencies.txt', lambda: Frequencies.objects.filter(scenario_id=scenario_id)),
        'transfers': ('transfers.txt', lambda: Transfers.objects.filter(scenario_id=scenario_id)),
        'pathways': ('pathways.txt', lambda: Pathway.objects.filter(scenario_id=scenario_id)),
        'levels': ('levels.txt', lambda: Level.objects.filter(scenario_id=scenario_id)),
        'location_groups': ('location_groups.txt', lambda: LocationGroup.objects.filter(scenario_id=scenario_id)),
        'location_group_stops': ('location_group_stops.txt', lambda: LocationGroupStop.objects.filter(scenario_id=scenario_id)),
        'booking_rules': ('booking_rules.txt', lambda: BookingRule.objects.filter(scenario_id=scenario_id)),
        'attributions': ('attributions.txt', lambda: Attribution.objects.filter(scenario_id=scenario_id)),

        'fare_attributes': ('fare_attributes.txt', lambda: FareAttribute.objects.filter(scenario_id=scenario_id)),
        'fare_rules': ('fare_rules.txt', lambda: FareRule.objects.filter(scenario_id=scenario_id)),
        'feed_info': ('feed_info.txt', lambda: FeedInfo.objects.filter(scenario_id=scenario_id).order_by('id')),
        'translations': ('translations.txt', lambda: Translation.objects.filter(scenario_id=scenario_id)),
        'timeframes': ('timeframes.txt', lambda: Timeframe.objects.filter(scenario_id=scenario_id)),
        'rider_categories': ('rider_categories.txt', lambda: RiderCategory.objects.filter(scenario_id=scenario_id)),
        'fare_media': ('fare_media.txt', lambda: FareMedia.objects.filter(scenario_id=scenario_id)),
        'fare_products': ('fare_products.txt', lambda: FareProduct.objects.filter(scenario_id=scenario_id)),
        'fare_leg_rules': ('fare_leg_rules.txt', lambda: FareLegRule.objects.filter(scenario_id=scenario_id)),
        'fare_leg_join_rules': ('fare_leg_join_rules.txt', lambda: FareLegJoinRule.objects.filter(scenario_id=scenario_id)),
        'fare_transfer_rules': ('fare_transfer_rules.txt', lambda: FareTransferRule.objects.filter(scenario_id=scenario_id)),
        'areas': ('areas.txt', lambda: Area.objects.filter(scenario_id=scenario_id)),
        'stop_areas': ('stop_areas.txt', lambda: StopArea.objects.filter(scenario_id=scenario_id)),
        'networks': ('networks.txt', lambda: Network.objects.filter(scenario_id=scenario_id)),
        'route_networks': ('route_networks.txt', lambda: RouteNetwork.objects.filter(scenario_id=scenario_id)),
    }

    keys = list(table_map.keys())

    EXCLUDED_FIELDS = ['id', 'scenario', 'created_datetime', 'updated_datetime']
    
    # 3.5) load imported schema: which files & which headers were originally present
    imported_files = GtfsImportedFile.objects.filter(scenario_id=scenario_id)
    imported_headers_by_file = {}
    for gf in imported_files:
        hdrs = list(
            GtfsImportedField.objects
            .filter(gtfs_file=gf)
            .order_by('column_index')
            .values_list('field_name', flat=True)
        )
        imported_headers_by_file[gf.file_name] = hdrs
    has_import_schema = imported_files.exists()

    # Fallback defaults for core files (used only when no imported schema exists)
    default_headers_by_file = {
        "agency.txt": [
            "agency_id", "agency_name", "agency_url", "agency_timezone",
            "agency_lang", "agency_phone", "agency_fare_url",
            "agency_email", "cemv_support",
        ],
        "stops.txt": [
            "stop_id", "stop_code", "stop_name", "stop_desc", "stop_lat", "stop_lon",
            "zone_id", "stop_url", "location_type", "parent_station",
            "wheelchair_boarding", "platform_code", "tts_stop_name", "stop_timezone",
            "level_id", "stop_access",
        ],
        "routes.txt": [
            "route_id", "agency_id", "route_short_name", "route_long_name", "route_desc",
            "route_type", "route_url", "route_color", "route_text_color",
            "route_sort_order", "continuous_pickup", "continuous_drop_off",
            "network_id", "cemv_support", "jp_parent_route_id",
        ],
        "trips.txt": [
            "trip_id", "route_id", "service_id", "trip_headsign", "trip_short_name",
            "direction_id", "block_id", "shape_id", "wheelchair_accessible",
            "bikes_allowed", "cars_allowed", "jp_trip_desc", "jp_trip_desc_symbol",
            "jp_office_id", "jp_pattern_id",
        ],
        "stop_times.txt": [
            "trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence",
            "stop_headsign", "pickup_type", "drop_off_type", "shape_dist_traveled",
            "location_group_id", "location_id", "start_pickup_drop_off_window",
            "end_pickup_drop_off_window", "continuous_pickup", "continuous_drop_off",
            "pickup_booking_rule_id", "drop_off_booking_rule_id", "timepoint",
            "is_arrival_time_next_day", "is_departure_time_next_day",
        ],
        "calendar.txt": [
            "service_id", "monday", "tuesday", "wednesday", "thursday",
            "friday", "saturday", "sunday", "start_date", "end_date",
        ],
        "calendar_dates.txt": ["service_id", "date", "exception_type"],
        "fare_attributes.txt": [
            "fare_id", "price", "currency_type", "payment_method",
            "transfers", "transfer_duration", "agency_id",
        ],
        "fare_rules.txt": ["fare_id", "route_id", "origin_id", "destination_id", "contains_id"],
        "shapes.txt": [
            "shape_id", "shape_pt_lat", "shape_pt_lon",
            "shape_pt_sequence", "shape_dist_traveled",
        ],
        "translations.txt": [
            "table_name", "field_name", "field_value", "language", "translation",
            "record_id", "record_sub_id", "route_id", "trip_id", "service_id",
            "stop_id", "shape_id", "feed_info_id",
        ],
        "feed_info.txt": [
            "feed_publisher_name", "feed_publisher_url", "feed_lang",
            "feed_start_date", "feed_end_date", "feed_version",
            "default_lang", "feed_contact_email", "feed_contact_url",
        ],
        "timeframes.txt": [
            "timeframe_group_id", "start_time", "end_time", "service_id",
        ],
        "rider_categories.txt": [
            "rider_category_id", "rider_category_name",
            "is_default_fare_category", "eligibility_url",
        ],
        "fare_media.txt": [
            "fare_media_id", "fare_media_name", "fare_media_type",
        ],
        "fare_products.txt": [
            "fare_product_id", "fare_product_name",
            "rider_category_id", "fare_media_id",
            "amount", "currency",
        ],
        "fare_leg_rules.txt": [
            "leg_group_id", "network_id", "from_area_id", "to_area_id",
            "from_timeframe_group_id", "to_timeframe_group_id",
            "fare_product_id", "rule_priority",
        ],
        "fare_leg_join_rules.txt": [
            "from_network_id", "to_network_id",
            "from_stop_id", "to_stop_id",
        ],
        "fare_transfer_rules.txt": [
            "from_leg_group_id", "to_leg_group_id",
            "transfer_count", "duration_limit", "duration_limit_type",
            "fare_transfer_type", "fare_product_id",
        ],
        "areas.txt": ["area_id", "area_name"],
        "stop_areas.txt": ["area_id", "stop_id"],
        "networks.txt": ["network_id", "network_name"],
        "route_networks.txt": ["network_id", "route_id"],
    }
    default_files = set(default_headers_by_file.keys())

    # If no imported schema exists (e.g., manually created scenario),
    # allow export only for default files using default headers.
    if not imported_headers_by_file:
        imported_headers_by_file = default_headers_by_file.copy()

    # Build effective headers map and force certain files to export when data exists,
    # even if they were not part of the original import.
    has_translations_data = Translation.objects.filter(scenario_id=scenario_id).exists()
    has_shapes_data = Shape.objects.filter(scenario_id=scenario_id).exists()
    has_calendar_data = Calendar.objects.filter(scenario_id=scenario_id).exists()
    has_calendar_dates_data = CalendarDates.objects.filter(scenario_id=scenario_id).exists()

    effective_headers_by_file = dict(imported_headers_by_file)
    if has_import_schema:
        if has_translations_data and "translations.txt" not in effective_headers_by_file:
            effective_headers_by_file["translations.txt"] = default_headers_by_file.get("translations.txt")
        if has_shapes_data and "shapes.txt" not in effective_headers_by_file:
            effective_headers_by_file["shapes.txt"] = default_headers_by_file.get("shapes.txt")
        if has_calendar_data and "calendar.txt" not in effective_headers_by_file:
            effective_headers_by_file["calendar.txt"] = default_headers_by_file.get("calendar.txt")
        if has_calendar_dates_data and "calendar_dates.txt" not in effective_headers_by_file:
            effective_headers_by_file["calendar_dates.txt"] = default_headers_by_file.get("calendar_dates.txt")
    else:
        # When there is no import schema, defaults already cover these files.
        effective_headers_by_file = default_headers_by_file.copy()

    # 4) build ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for key in keys:
            filename, qs_fn = table_map[key]
            qs = qs_fn()

            if has_import_schema:
                # Only export files that were actually imported,
                # except for forced files with data (handled in effective_headers_by_file)
                if filename not in effective_headers_by_file:
                    continue
                imported_headers = effective_headers_by_file.get(filename)
            else:
                # Fallback: only export default files with default headers
                if filename not in default_headers_by_file:
                    continue
                imported_headers = default_headers_by_file.get(filename)

            if key == 'translations':
                buf = io.StringIO()
                writer = csv.writer(
                    buf,
                    quotechar="|",
                    escapechar="\\",
                    doublequote=False,
                    quoting=csv.QUOTE_MINIMAL,
                    lineterminator="\n",
                )

                headers = imported_headers or [
                    f.name for f in Translation._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]

                # Append record_id / record_sub_id only when data exists (similar to stop_code handling)
                if "record_id" not in headers:
                    has_record_id = qs.exclude(record_id__isnull=True).exclude(record_id="").exists()
                    if has_record_id:
                        headers.append("record_id")

                if "record_sub_id" not in headers:
                    has_record_sub_id = qs.exclude(record_sub_id__isnull=True).exclude(record_sub_id="").exists()
                    if has_record_sub_id:
                        headers.append("record_sub_id")

                writer.writerow(headers)

                if qs.exists():
                    for obj in qs:
                        row = []
                        for h in headers:
                            if h == "field_value":
                                val = getattr(obj, "field_value", "") or ""
                            else:
                                val = getattr(obj, h, "")
                            row.append(val)
                        writer.writerow(row)

                zf.writestr(filename, buf.getvalue())
                continue

            # optional: date‐filter your calendar or stop_times here
            if key == 'calendar' and start_date and end_date:
                qs = qs.filter(start_date__lte=end_date, end_date__gte=start_date)

            # Special handling for stops to use imported headers only
            if key == 'stops':
                buf = io.StringIO()
                writer = csv.writer(buf)

                headers = imported_headers or [
                    f.name for f in Stops._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]
                if "stop_code" not in headers:
                    has_stop_code = Stops.objects.filter(
                        scenario_id=scenario_id
                    ).exclude(stop_code__isnull=True).exclude(stop_code="").exists()
                    if has_stop_code:
                        headers.append("stop_code")
                writer.writerow(headers)

                if qs.exists():
                    for obj in qs:
                        row = []
                        for h in headers:
                            val = getattr(obj, h, '')
                            row.append(val)
                        writer.writerow(row)
                
                zf.writestr(filename, buf.getvalue())
                continue

            # Special handling for shapes based on imported headers (not on data content)
            if key == 'shapes':
                buf = io.StringIO()
                writer = csv.writer(buf)

                headers = imported_headers or [
                    f.name for f in Shape._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]
                writer.writerow(headers)
                
                if qs.exists():
                    for obj in qs.order_by('shape_id', 'shape_pt_sequence'):
                        row = []
                        for h in headers:
                            val = getattr(obj, h, '')
                            row.append(val)
                        writer.writerow(row)
                
                zf.writestr(filename, buf.getvalue())
                continue

            if key == 'routes':
                buf = io.StringIO()
                writer = csv.writer(buf)

                headers = imported_headers or [
                    f.name for f in Routes._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]
                if "route_short_name" not in headers:
                    has_route_short_name = Routes.objects.filter(
                        scenario_id=scenario_id
                    ).exclude(route_short_name__isnull=True).exclude(route_short_name="").exists()
                    if has_route_short_name:
                        headers.append("route_short_name")
                if "route_long_name" not in headers:
                    has_route_long_name = Routes.objects.filter(
                        scenario_id=scenario_id
                    ).exclude(route_long_name__isnull=True).exclude(route_long_name="").exists()
                    if has_route_long_name:
                        headers.append("route_long_name")
                writer.writerow(headers)

                if qs.exists():
                    for obj in qs:
                        row = []
                        for h in headers:
                            val = getattr(obj, h, '')
                            row.append(val)
                        writer.writerow(row)

                zf.writestr(filename, buf.getvalue())
                continue

            if key == 'trips':
                buf = io.StringIO()
                writer = csv.writer(buf)

                headers = imported_headers or [
                    f.name for f in Trips._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]
                if "direction_id" not in headers:
                    has_direction_id = Trips.objects.filter(
                        scenario_id=scenario_id,
                        direction_id__isnull=False,
                    ).exists()
                    if has_direction_id:
                        headers.append("direction_id")
                if "shape_id" not in headers:
                    has_shape_id = Trips.objects.filter(
                        scenario_id=scenario_id,
                    ).exclude(shape_id__isnull=True).exclude(shape_id="").exists()
                    if has_shape_id:
                        headers.append("shape_id")
                if "trip_headsign" not in headers:
                    has_trip_headsign = Trips.objects.filter(
                        scenario_id=scenario_id
                    ).exclude(trip_headsign__isnull=True).exclude(trip_headsign="").exists()
                    if has_trip_headsign:
                        headers.append("trip_headsign")
                writer.writerow(headers)

                if qs.exists():
                    for obj in qs:
                        row = []
                        for h in headers:
                            val = getattr(obj, h, '')
                            row.append(val)
                        writer.writerow(row)

                zf.writestr(filename, buf.getvalue())
                continue

            # Special handling for stop_times to conditionally include columns
            # based on imported headers AND convert time back to GTFS format
            if key == 'stop_times':
                buf = io.StringIO()
                writer = csv.writer(buf)
                
                headers = imported_headers or [
                    f.name for f in StopTimes._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]
                writer.writerow(headers)
                
                if qs.exists():
                    for obj in qs.order_by('trip_id', 'stop_sequence'):
                        row = []
                        for h in headers:
                            if h == 'arrival_time':
                                val = _time_to_gtfs_string(
                                    obj.arrival_time,
                                    getattr(obj, 'is_arrival_time_next_day', False)
                                )
                            elif h == 'departure_time':
                                val = _time_to_gtfs_string(
                                    obj.departure_time,
                                    getattr(obj, 'is_departure_time_next_day', False)
                                )
                            elif h in ('pickup_type', 'drop_off_type', 'timepoint'):
                                v = getattr(obj, h, None)
                                val = v if v is not None else ''
                            elif h == 'shape_dist_traveled':
                                v = getattr(obj, h, None)
                                val = v if v is not None else ''
                            else:
                                val = getattr(obj, h, '')
                            row.append(val)
                        
                        writer.writerow(row)
                
                zf.writestr(filename, buf.getvalue())
                continue

            # Special handling for feed_info to map GTFS names → model fields
            if key == 'feed_info':
                buf = io.StringIO()
                writer = csv.writer(buf)
                headers = imported_headers or [
                    "feed_publisher_name",
                    "feed_publisher_url",
                    "feed_lang",
                    "feed_start_date",
                    "feed_end_date",
                    "feed_version",
                    "default_lang",
                    "feed_contact_email",
                    "feed_contact_url",
                ]
                writer.writerow(headers)
                for (i,obj) in enumerate(qs):
                    row = []
                    # Precompute strings for convenience
                    start_str = obj.feed_start_date.strftime('%Y%m%d') if obj.feed_start_date else ''
                    end_str = obj.feed_end_date.strftime('%Y%m%d') if obj.feed_end_date else ''
                    version_str = f"{start_str}改正-MobilysVer0.1" if start_str else "改正-MobilysVer0.1"

                    for h in headers:
                        if h == 'feed_publisher_name':
                            val = obj.feed_publisher_name
                        elif h == 'feed_publisher_url':
                            val = obj.feed_publisher_url
                        elif h == 'feed_lang':
                            val = obj.feed_lang
                        elif h == 'feed_start_date':
                            val = start_str
                        elif h == 'feed_end_date':
                            val = end_str
                        elif h == 'feed_version':
                            val = i == 0 and version_str or obj.feed_version
                        elif h == 'default_lang':
                            val = getattr(obj, 'default_lang', '')
                        elif h == 'feed_contact_email':
                            val = getattr(obj, 'feed_contact_email', '')
                        elif h == 'feed_contact_url':
                            val = getattr(obj, 'feed_contact_url', '')
                        else:
                            val = getattr(obj, h, '')
                        row.append(val)

                    writer.writerow(row)
                zf.writestr(filename, buf.getvalue())
                continue

            # Special handling for fare_rules: map fare_id → FK
            if key == 'fare_rules':
                buf = io.StringIO()
                writer = csv.writer(buf)
                headers = imported_headers or [
                    "fare_id",
                    "route_id",
                    "origin_id",
                    "destination_id",
                    "contains_id",
                ]
                writer.writerow(headers)
                for obj in qs:
                    row = []
                    for h in headers:
                        if h == 'fare_id':
                            # Prefer explicit fare_id field; fall back to FK if needed
                            val = getattr(obj, 'fare_id', '') or (obj.fare_attribute.fare_id if obj.fare_attribute else '')
                        else:
                            val = getattr(obj, h, '')
                        row.append(val)
                    writer.writerow(row)
                zf.writestr(filename, buf.getvalue())
                continue

            # Special handling for location_group_stops: header has location_group_id,
            # model has FK "location_group"
            if key == 'location_group_stops':
                buf = io.StringIO()
                writer = csv.writer(buf)
                headers = imported_headers or ["location_group_id", "stop_id"]
                writer.writerow(headers)

                if qs.exists():
                    for obj in qs:
                        row = []
                        for h in headers:
                            if h == 'location_group_id':
                                # Use FK to get the actual ID string
                                val = obj.location_group.location_group_id if obj.location_group else ''
                            else:
                                val = getattr(obj, h, '')
                            row.append(val)
                        writer.writerow(row)

                zf.writestr(filename, buf.getvalue())
                continue

            # write CSV (generic branch)
            buf = io.StringIO()
            writer = csv.writer(buf)

            if qs.exists():
                # infer headers from imported schema (if available),
                # otherwise from model fields (minus id and scenario FK)
                headers = imported_headers or [
                    f.name for f in qs.model._meta.fields
                    if f.name not in EXCLUDED_FIELDS
                ]
                writer.writerow(headers)

                for obj in qs:
                    row = []
                    for h in headers:
                        val = getattr(obj, h, '')

                        # Normalize date formats for calendar / calendar_dates
                        if key == 'calendar' and h in ('start_date', 'end_date') and val:
                            # Export as YYYYMMDD
                            if hasattr(val, "strftime"):
                                val = val.strftime('%Y%m%d')
                            else:
                                s = str(val)
                                val = s.replace('-', '') if s else s

                        if key == 'calendar_dates' and h == 'date' and val:
                            # Export as YYYYMMDD
                            if hasattr(val, "strftime"):
                                val = val.strftime('%Y%m%d')
                            else:
                                s = str(val)
                                val = s.replace('-', '') if s else s

                        # Normalize fare price: integer string, no decimals
                        if key == 'fare_attributes' and h == 'price' and val is not None:
                            try:
                                dec = Decimal(str(val))
                                # Drop fractional part (prices are integer in current feeds)
                                val = str(int(dec))
                            except Exception:
                                s = str(val)
                                if '.' in s:
                                    s = s.rstrip('0').rstrip('.')
                                val = s

                        row.append(val)

                    writer.writerow(row)
            else:
                # Still write header row if we have imported headers (empty feed)
                headers = imported_headers or []
                writer.writerow(headers)

            zf.writestr(filename, buf.getvalue())

    zip_buffer.seek(0)
    return zip_buffer


def update_scenario_region_and_prefecture(scenario_id):
    """
    Update Scenario.prefecture_info and Scenario.region_info
    using get_region_and_prefectures_by_scenario.
    """

    info = get_region_and_prefectures_by_scenario(scenario_id)
    if not info:
        return False

    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        return False

    # Save to ArrayField fields (prefecture_info, region_info)
    scenario.prefecture_info = info.get("prefectures", [])
    scenario.region_info = [info.get("region")] if info.get("region") else []
    scenario.save(update_fields=["prefecture_info", "region_info"])
    return True


def _norm_project_id(raw):
    """
    Treat absent, "", "None", "null", "undefined" (case-insensitive, trimmed)
    as *no project*. Otherwise return the original string.
    """
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if s in {"", "none", "null", "undefined"}:
        return None
    return raw  # keep as-is (could be UUID str)

def get_accessible_scenario_or_404(*, user, scenario_id, project_id=None):
    """
    Access rule:
    - Owned scenario always accessible
    - Shared scenario accessible if scenario owner shares at least one project with user
    - If project_id is provided, restrict sharing to that project (and require user is in it)
    """

    base_qs = Scenario.objects.select_related("user", "source_scenario")

    owned_filter = Q(user=user)

    shared_filter = Q(
        user__project_mappings__project__user_mappings__user=user
    )

    if project_id:
        if not ProjectUserMap.objects.filter(project_id=project_id, user=user).exists():
            raise PermissionDenied("You are not a member of this project.")

        shared_filter &= Q(user__project_mappings__project_id=project_id)


        owned_filter &= Q(user__project_mappings__project_id=project_id)

    return get_object_or_404(
        base_qs.filter(owned_filter | shared_filter).distinct(),
        id=scenario_id
    )
