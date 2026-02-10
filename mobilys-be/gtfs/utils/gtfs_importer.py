import zipfile
import io
import csv
import json
from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

from ..models import (
    Agency, AgencyJP,
    Stops, Routes, Shape, Trips, StopTimes,
    Calendar, CalendarDates,
    FeedInfo, Translation,
    FareAttribute, FareRule,
    Frequencies, Transfers,
    OfficeJP, PatternJP,
    Pathway, Level,
    LocationGroup, LocationGroupStop,
    BookingRule, Attribution,
    GtfsImportedFile, GtfsImportedField,
    Timeframe, RiderCategory,
    FareMedia, FareProduct,
    FareLegRule, FareLegJoinRule, FareTransferRule,
    Area, StopArea,
    Network, RouteNetwork,
)
from rest_framework.exceptions import ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from .stop_data_standardizer import StopDataStandardizer
from .shape_generator import ShapeGenerator
from .routeid_standardization import process_gtfs_df
from .direction_id_generator import DirectionIDGenerator
from gtfs.utils.translation_utils import upsert_translations
from gtfs.utils.scenario_utils import update_scenario_region_and_prefecture

import logging
from mobilys_BE.shared.log_json import log_json

logger = logging.getLogger(__name__)

class GTFSImportError(Exception):
    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__("GTFSインポートにエラーが発生しました。")

class GTFSImporter:
    def __init__(self, scenario, zip_file):
        self.scenario = scenario
        self.zip_file = zip_file

    COORD_PRECISION = Decimal("0.000001")
    
    def round_coord_6(self, value):
        """
        Convert a raw CSV coordinate string to Decimal with 6 decimal places.
        Returns None if empty.
        """
        if value is None:
            return None

        s = str(value).strip()
        if s == "" or s in ("None", "null"):
            return None
        d = Decimal(s)
        return d.quantize(self.COORD_PRECISION, rounding=ROUND_HALF_UP)
    
    def _parse_gtfs_time(self, time_str):
        """
        Parse GTFS time string that can exceed 24:00:00.
        
        Returns:
            tuple: (time_object, is_next_day)
        """
        if not time_str or not time_str.strip():
            raise ValueError("Time string is empty")
        
        time_str = time_str.strip()
        parts = time_str.split(':')
        
        if len(parts) != 3:
            raise ValueError(f"Invalid time format: {time_str}")
        
        try:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = int(parts[2])
        except (ValueError, IndexError):
            raise ValueError(f"Invalid time components: {time_str}")
        
        # Check if time is next day (>= 24:00:00)
        is_next_day = hours >= 24
        
        # Convert to normal time format
        if is_next_day:
            # Normalize hours to 0-23 range
            normalized_hours = hours % 24
            time_obj = time(normalized_hours, minutes, seconds)
        else:
            time_obj = time(hours, minutes, seconds)
        
        return time_obj, is_next_day
        
    def _err(self, *, source, code, message, file=None, row=None, details=None):
        return {
            "source": source,          # "external" | "internal"
            "code": code,              # e.g. "missing_required_files", "validation_error", "parse_error"
            "message": str(message),
            "file": file,              # "stops.txt"
            "row": row,                # Row number (1-based)
            "details": details or {},  # Optional dict
        }

    def _upsert_translations_from_objects(self, translations):
        from collections import defaultdict

        buckets = defaultdict(list)
        for t in translations:
            key = (
                (t.table_name or "").strip(),
                (t.route_id or "").strip(),
                (t.trip_id or "").strip(),
                (t.service_id or "").strip(),
                (t.stop_id or "").strip(),
                (t.shape_id or "").strip(),
                (t.feed_info_id or "").strip(),
            )
            buckets[key].append(t)
        for (
            table_name, route_id, trip_id, service_id, stop_id, shape_id, feed_info_id), rows in buckets.items():
            seen = set()
            items = []
            for r in rows:
                fn = (r.field_name or "").strip()
                lang = (r.language or "").strip()
                if not fn or not lang:
                    continue
                key2 = (fn, lang)
                if key2 in seen:
                    continue
                seen.add(key2)
                items.append({
                    "field_name": fn,
                    "language": lang,
                    "translation": (r.translation or "").strip(),
                    "field_value": (r.field_value or "").strip(),
                })
            if not items:
                continue

            upsert_translations(
                scenario_id = str(self.scenario.id),
                table_name = table_name,
                entity_ids = {
                    "route_id": route_id,
                    "trip_id": trip_id,
                    "service_id": service_id,
                    "stop_id": stop_id,
                    "shape_id": shape_id,
                    "feed_info_id": feed_info_id,
                },
                items = items,
            )

    def _record_imported_schema(self, zip_obj, zip_contents):
        """
        Inspect all *.txt files in the zip and persist:
          - which GTFS files were present for this scenario
          - which columns (and their order) each file had
        This is used later on export to only output columns that were
        actually present in the original import.
        """
        def _model_headers(model_cls):
            # Exclude internal/meta fields; keep user-facing GTFS fields only
            return {
                f.name
                for f in model_cls._meta.fields
                if f.name not in {"id", "scenario", "created_datetime", "updated_datetime"}
            }

        # Allowed headers per GTFS file (only persisted if they exist in the model)
        allowed_headers_by_file = {
            "agency.txt": _model_headers(Agency),
            "agency_jp.txt": _model_headers(AgencyJP),
            "office_jp.txt": _model_headers(OfficeJP),
            "pattern_jp.txt": _model_headers(PatternJP),
            "stops.txt": _model_headers(Stops),
            "routes.txt": _model_headers(Routes),
            "trips.txt": _model_headers(Trips),
            "stop_times.txt": _model_headers(StopTimes),
            "calendar.txt": _model_headers(Calendar),
            "calendar_dates.txt": _model_headers(CalendarDates),
            "shapes.txt": _model_headers(Shape),
            "frequencies.txt": _model_headers(Frequencies),
            "transfers.txt": _model_headers(Transfers),
            "pathways.txt": _model_headers(Pathway),
            "levels.txt": _model_headers(Level),
            "location_groups.txt": _model_headers(LocationGroup),
            # CSV uses location_group_id (FK raw value)
            "location_group_stops.txt": {"location_group_id", "stop_id"},
            "booking_rules.txt": _model_headers(BookingRule),
            "attributions.txt": _model_headers(Attribution),
            "fare_attributes.txt": _model_headers(FareAttribute),
            # CSV uses fare_id (maps to FareAttribute)
            "fare_rules.txt": {"fare_id", "route_id", "origin_id", "destination_id", "contains_id"},
            # feed_info uses GTFS column names; map to model fields but accept GTFS headers
            "feed_info.txt": {
                "feed_publisher_name",
                "feed_publisher_url",
                "feed_lang",
                "feed_start_date",
                "feed_end_date",
                "feed_version",
                "default_lang",
                "feed_contact_email",
                "feed_contact_url",
            },
            # translations uses GTFS column names
            "translations.txt": {
                "table_name",
                "field_name",
                "field_value",
                "language",
                "translation",
                "record_id",
                "record_sub_id",
                "route_id",
                "trip_id",
                "service_id",
                "stop_id",
                "shape_id",
                "feed_info_id",
            },
            "timeframes.txt": {
                "timeframe_group_id",
                "start_time",
                "end_time",
                "service_id",
            },
            "rider_categories.txt": {
                "rider_category_id",
                "rider_category_name",
                "is_default_fare_category",
                "eligibility_url",
            },
            "fare_media.txt": {
                "fare_media_id",
                "fare_media_name",
                "fare_media_type",
            },
            "fare_products.txt": {
                "fare_product_id",
                "fare_product_name",
                "rider_category_id",
                "fare_media_id",
                "amount",
                "currency",
            },
            "fare_leg_rules.txt": {
                "leg_group_id",
                "network_id",
                "from_area_id",
                "to_area_id",
                "from_timeframe_group_id",
                "to_timeframe_group_id",
                "fare_product_id",
                "rule_priority",
            },
            "fare_leg_join_rules.txt": {
                "from_network_id",
                "to_network_id",
                "from_stop_id",
                "to_stop_id",
            },
            "fare_transfer_rules.txt": {
                "from_leg_group_id",
                "to_leg_group_id",
                "transfer_count",
                "duration_limit",
                "duration_limit_type",
                "fare_transfer_type",
                "fare_product_id",
            },
            "areas.txt": {"area_id", "area_name"},
            "stop_areas.txt": {"area_id", "stop_id"},
            "networks.txt": {"network_id", "network_name"},
            "route_networks.txt": {"network_id", "route_id"},
        }

        # Clean previous schema info for this scenario
        GtfsImportedFile.objects.filter(scenario=self.scenario).delete()

        for name in zip_contents:
            if not (name.endswith(".txt") or name.endswith(".geojson")):
                continue

            # Normalize to standard GTFS basename (handles folders in ZIP)
            std_name = name.split("/")[-1]

            try:
                if std_name.endswith(".txt"):
                    with zip_obj.open(name) as f:
                        decoded = io.TextIOWrapper(f, encoding="utf-8-sig")
                        reader = csv.reader(decoded)
                        try:
                            header = next(reader)
                        except StopIteration:
                            header = []
                else:
                    header = []
            except Exception:
                header = []

            imported_file = GtfsImportedFile.objects.create(
                scenario=self.scenario,
                file_name=std_name,
                original_name=name,
            )

            allowed_headers = allowed_headers_by_file.get(std_name, set())

            for idx, col in enumerate(header):
                col_name = (col or "").strip()
                if not col_name:
                    continue
                # Only persist columns that correspond to a known model/GTFS field
                if allowed_headers and col_name not in allowed_headers:
                    continue

                GtfsImportedField.objects.create(
                    gtfs_file=imported_file,
                    field_name=col_name,
                    column_index=idx,
                )

    def process(self):
        BATCH_SIZE = 5000  
        feed_date_info = None

        required_files = [
            'routes.txt', 'trips.txt', 'stop_times.txt', 'agency.txt',
            'stops.txt', 'feed_info.txt'
        ]
        
        # Separate critical errors vs warnings
        critical_errors = []  # Errors from required/core files → STOP IMPORT
        warning_errors = []   # Errors from optional files → CONTINUE IMPORT
        
        objects = {
            'stops': [], 'routes': [], 'trips': [], 'stop_times': [],
            'agency': [], 'shapes': [], 'calendar': [], 'calendar_dates': [],
            'feed_info': [], 'translations': [],
            'fare_attributes': [], 'fare_rules': [],
            # new GTFS global/JP models
            'frequencies': [],
            'transfers': [],
            'agency_jp': [],
            'office_jp': [],
            'pattern_jp': [],
            'pathways': [],
            'levels': [],
            'location_groups': [],
            'location_group_stops_pending': [],
            'booking_rules': [],
            'attributions': [],
            'timeframes': [],
            'rider_categories': [],
            'fare_media': [],
            'fare_products': [],
            'fare_leg_rules': [],
            'fare_leg_join_rules': [],
            'fare_transfer_rules': [],
            'areas': [],
            'stop_areas': [],
            'networks': [],
            'route_networks': [],
        }

        fare_attr_filename = None
        fare_rules_filename = None

        with zipfile.ZipFile(self.zip_file, 'r') as z:
            zip_contents = z.namelist()

            # Track imported files & columns (for export)
            self._record_imported_schema(z, zip_contents)

            # Validate required files
            missing_files = [f for f in required_files if f not in zip_contents]
            if missing_files:
                raise GTFSImportError([self._err(
                    source="internal",
                    code="missing_required_files",
                    message="必要なGTFSファイルが不足しています。",
                    file="zip",
                    details={"missing_files": missing_files},
                )])
                
            # Detect optional fare files
            if 'fare_attributes.txt' in zip_contents:
                fare_attr_filename = 'fare_attributes.txt'
            if 'fare_rules.txt' in zip_contents:
                fare_rules_filename = 'fare_rules.txt'

            # Parse CORE files (critical - stop on error)
            for file_name in zip_contents:
                # Skip optional files - process separately
                if file_name in (
                    'fare_attributes.txt',
                    'fare_rules.txt',
                    'translations.txt',
                    'frequencies.txt',
                    'transfers.txt',
                    'agency_jp.txt',
                    'office_jp.txt',
                    'pattern_jp.txt',
                    'pathways.txt',
                    'levels.txt',
                    'location_groups.txt',
                    'location_group_stops.txt',
                    'booking_rules.txt',
                    'attributions.txt',
                    'timeframes.txt',
                    'rider_categories.txt',
                    'fare_media.txt',
                    'fare_products.txt',
                    'fare_leg_rules.txt',
                    'fare_leg_join_rules.txt',
                    'fare_transfer_rules.txt',
                    'areas.txt',
                    'stop_areas.txt',
                    'networks.txt',
                    'route_networks.txt',
                ):
                    continue
                if not file_name.endswith('.txt'):
                    continue

                with z.open(file_name) as file:
                    if file_name == 'routes.txt':
                        objs, errs = self.process_routes_file(file)
                        objects['routes'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'trips.txt':
                        objs, errs = self.process_trips_file(file)
                        objects['trips'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'stop_times.txt':
                        objs, errs = self.process_stop_times_file(file)
                        objects['stop_times'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'agency.txt':
                        objs, errs = self.process_agency_file(file)
                        objects['agency'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'stops.txt':
                        objs, errs = self.process_stops_file(file)
                        objects['stops'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'shapes.txt':
                        objs, errs = self.process_shapes_file(file)
                        objects['shapes'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'calendar.txt':
                        objs, errs = self.process_calendar_file(file)
                        objects['calendar'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'calendar_dates.txt':
                        objs, errs = self.process_calendar_dates_file(file)
                        objects['calendar_dates'].extend(objs); critical_errors.extend(errs)
                    elif file_name == 'feed_info.txt':
                        objs, errs, date_info = self.process_feed_info_file(file)
                        objects['feed_info'].extend(objs); critical_errors.extend(errs)
                        feed_date_info = date_info
                 

        # Stop early ONLY for critical errors from core files
        print(critical_errors, warning_errors, "about to raise")
        if critical_errors:
            raise GTFSImportError(critical_errors)
        
        if feed_date_info and feed_date_info.get("start_date") and feed_date_info.get("end_date"):
            if (self.scenario.start_date != feed_date_info["start_date"] or
                self.scenario.end_date   != feed_date_info["end_date"]):
                self.scenario.start_date = feed_date_info["start_date"]
                self.scenario.end_date   = feed_date_info["end_date"]
                self.scenario.save(update_fields=["start_date", "end_date"])

        # NOW process OPTIONAL files (after core data but BEFORE bulk insert)
        # This ensures we collect ALL warnings before committing data
        with zipfile.ZipFile(self.zip_file, 'r') as z:
            zip_contents = z.namelist()
            
            # Process translations (optional - warning only)
            if 'translations.txt' in z.namelist():
                with z.open('translations.txt') as file:
                    objs, errs = self.process_translations_file(file)
                    objects['translations'].extend(objs)
                    warning_errors.extend(errs)  # ✅ Collect as warnings
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="translations.txt",
                    scenario_id=str(self.scenario.id),
                )
            
            # Process fare_attributes (optional - warning only)
            if fare_attr_filename:
                with z.open(fare_attr_filename) as f:
                    fare_attrs_objs, warns = self.process_fare_attributes_file(f)
                    objects['fare_attributes'] = fare_attrs_objs
                    warning_errors.extend(warns)  # Collect as warnings
            
            # Process fare_rules (optional - warning only)
            if fare_rules_filename:
                with z.open(fare_rules_filename) as f:
                    pending_rules, warns = self.process_fare_rules_file(f)
                    objects['fare_rules'] = pending_rules
                    warning_errors.extend(warns)  # Collect as warnings

            # NEW OPTIONAL FILES

            # frequencies.txt
            if 'frequencies.txt' in zip_contents:
                with z.open('frequencies.txt') as f:
                    objs, errs = self.process_frequencies_file(f)
                    objects['frequencies'].extend(objs)
                    warning_errors.extend(errs)
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="frequencies.txt",
                    scenario_id=str(self.scenario.id),
                )

            # transfers.txt
            if 'transfers.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="transfers.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('transfers.txt') as f:
                    objs, errs = self.process_transfers_file(f)
                    objects['transfers'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="transfers.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="transfers.txt",
                    scenario_id=str(self.scenario.id),
                )

            # agency_jp.txt
            if 'agency_jp.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="agency_jp.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('agency_jp.txt') as f:
                    objs, errs = self.process_agency_jp_file(f)
                    objects['agency_jp'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="agency_jp.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="agency_jp.txt",
                    scenario_id=str(self.scenario.id),
                )

            # office_jp.txt
            if 'office_jp.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="office_jp.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('office_jp.txt') as f:
                    objs, errs = self.process_office_jp_file(f)
                    objects['office_jp'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="office_jp.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="office_jp.txt",
                    scenario_id=str(self.scenario.id),
                )

            # pattern_jp.txt
            if 'pattern_jp.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="pattern_jp.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('pattern_jp.txt') as f:
                    objs, errs = self.process_pattern_jp_file(f)
                    objects['pattern_jp'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="pattern_jp.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="pattern_jp.txt",
                    scenario_id=str(self.scenario.id),
                )

            # pathways.txt
            if 'pathways.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="pathways.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('pathways.txt') as f:
                    objs, errs = self.process_pathways_file(f)
                    objects['pathways'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="pathways.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="pathways.txt",
                    scenario_id=str(self.scenario.id),
                )

            # levels.txt
            if 'levels.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="levels.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('levels.txt') as f:
                    objs, errs = self.process_levels_file(f)
                    objects['levels'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="levels.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="levels.txt",
                    scenario_id=str(self.scenario.id),
                )

            # location_groups.txt
            if 'location_groups.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="location_groups.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('location_groups.txt') as f:
                    objs, errs = self.process_location_groups_file(f)
                    objects['location_groups'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="location_groups.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="location_groups.txt",
                    scenario_id=str(self.scenario.id),
                )

            # location_group_stops.txt
            if 'location_group_stops.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="location_group_stops.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('location_group_stops.txt') as f:
                    pending, errs = self.process_location_group_stops_file(f)
                    objects['location_group_stops_pending'].extend(pending)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="location_group_stops.txt",
                        scenario_id=str(self.scenario.id),
                        pending_count=len(pending),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="location_group_stops.txt",
                    scenario_id=str(self.scenario.id),
                )

            # booking_rules.txt
            if 'booking_rules.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="booking_rules.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('booking_rules.txt') as f:
                    objs, errs = self.process_booking_rules_file(f)
                    objects['booking_rules'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="booking_rules.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="booking_rules.txt",
                    scenario_id=str(self.scenario.id),
                )

            # attributions.txt
            if 'attributions.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="attributions.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('attributions.txt') as f:
                    objs, errs = self.process_attributions_file(f)
                    objects['attributions'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="attributions.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="attributions.txt",
                    scenario_id=str(self.scenario.id),
                )

            # timeframes.txt
            if 'timeframes.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="timeframes.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('timeframes.txt') as f:
                    objs, errs = self.process_timeframes_file(f)
                    objects['timeframes'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="timeframes.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="timeframes.txt",
                    scenario_id=str(self.scenario.id),
                )

            # rider_categories.txt
            if 'rider_categories.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="rider_categories.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('rider_categories.txt') as f:
                    objs, errs = self.process_rider_categories_file(f)
                    objects['rider_categories'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="rider_categories.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="rider_categories.txt",
                    scenario_id=str(self.scenario.id),
                )

            # fare_media.txt
            if 'fare_media.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="fare_media.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('fare_media.txt') as f:
                    objs, errs = self.process_fare_media_file(f)
                    objects['fare_media'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="fare_media.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="fare_media.txt",
                    scenario_id=str(self.scenario.id),
                )

            # fare_products.txt
            if 'fare_products.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="fare_products.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('fare_products.txt') as f:
                    objs, errs = self.process_fare_products_file(f)
                    objects['fare_products'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="fare_products.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="fare_products.txt",
                    scenario_id=str(self.scenario.id),
                )

            # fare_leg_rules.txt
            if 'fare_leg_rules.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="fare_leg_rules.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('fare_leg_rules.txt') as f:
                    objs, errs = self.process_fare_leg_rules_file(f)
                    objects['fare_leg_rules'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="fare_leg_rules.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="fare_leg_rules.txt",
                    scenario_id=str(self.scenario.id),
                )

            # fare_leg_join_rules.txt
            if 'fare_leg_join_rules.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="fare_leg_join_rules.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('fare_leg_join_rules.txt') as f:
                    objs, errs = self.process_fare_leg_join_rules_file(f)
                    objects['fare_leg_join_rules'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="fare_leg_join_rules.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="fare_leg_join_rules.txt",
                    scenario_id=str(self.scenario.id),
                )

            # fare_transfer_rules.txt
            if 'fare_transfer_rules.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="fare_transfer_rules.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('fare_transfer_rules.txt') as f:
                    objs, errs = self.process_fare_transfer_rules_file(f)
                    objects['fare_transfer_rules'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="fare_transfer_rules.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="fare_transfer_rules.txt",
                    scenario_id=str(self.scenario.id),
                )

            # areas.txt
            if 'areas.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="areas.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('areas.txt') as f:
                    objs, errs = self.process_areas_file(f)
                    objects['areas'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="areas.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="areas.txt",
                    scenario_id=str(self.scenario.id),
                )

            # stop_areas.txt
            if 'stop_areas.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="stop_areas.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('stop_areas.txt') as f:
                    objs, errs = self.process_stop_areas_file(f)
                    objects['stop_areas'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="stop_areas.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="stop_areas.txt",
                    scenario_id=str(self.scenario.id),
                )

            # networks.txt
            if 'networks.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="networks.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('networks.txt') as f:
                    objs, errs = self.process_networks_file(f)
                    objects['networks'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="networks.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="networks.txt",
                    scenario_id=str(self.scenario.id),
                )

            # route_networks.txt
            if 'route_networks.txt' in zip_contents:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_found",
                    file="route_networks.txt",
                    scenario_id=str(self.scenario.id),
                )
                with z.open('route_networks.txt') as f:
                    objs, errs = self.process_route_networks_file(f)
                    objects['route_networks'].extend(objs)
                    warning_errors.extend(errs)
                    log_json(
                        logger,
                        logging.DEBUG,
                        "file_processing_result",
                        file="route_networks.txt",
                        scenario_id=str(self.scenario.id),
                        objects_count=len(objs),
                        errors_count=len(errs),
                    )
            else:
                log_json(
                    logger,
                    logging.DEBUG,
                    "optional_file_missing",
                    file="route_networks.txt",
                    scenario_id=str(self.scenario.id),
                )
        
        log_json(
            logger,
            logging.DEBUG,
            "warning_errors_total",
            scenario_id=str(self.scenario.id),
            count=len(warning_errors),
        )

        # Bulk writes (batched) - NOW after all warnings collected
        if objects['translations']:
            Translation.objects.bulk_create(objects['translations'], batch_size=BATCH_SIZE)
        Agency.objects.bulk_create(objects['agency'], batch_size=BATCH_SIZE)
        Stops.objects.bulk_create(objects['stops'], batch_size=BATCH_SIZE)
        Routes.objects.bulk_create(objects['routes'], batch_size=BATCH_SIZE)
        Shape.objects.bulk_create(objects['shapes'], batch_size=BATCH_SIZE)
        Trips.objects.bulk_create(objects['trips'], batch_size=BATCH_SIZE)
        StopTimes.objects.bulk_create(objects['stop_times'], batch_size=BATCH_SIZE)
        Calendar.objects.bulk_create(objects['calendar'], batch_size=BATCH_SIZE)
        CalendarDates.objects.bulk_create(objects['calendar_dates'], batch_size=BATCH_SIZE)
        FeedInfo.objects.bulk_create(objects['feed_info'], batch_size=BATCH_SIZE)

        # NEW bulk inserts
        if objects['frequencies']:
            Frequencies.objects.bulk_create(objects['frequencies'], batch_size=BATCH_SIZE)
        if objects['transfers']:
            Transfers.objects.bulk_create(objects['transfers'], batch_size=BATCH_SIZE)
        if objects['agency_jp']:
            AgencyJP.objects.bulk_create(objects['agency_jp'], batch_size=BATCH_SIZE)
        if objects['office_jp']:
            OfficeJP.objects.bulk_create(objects['office_jp'], batch_size=BATCH_SIZE)
        if objects['pattern_jp']:
            PatternJP.objects.bulk_create(objects['pattern_jp'], batch_size=BATCH_SIZE)
        if objects['pathways']:
            Pathway.objects.bulk_create(objects['pathways'], batch_size=BATCH_SIZE)
        if objects['levels']:
            Level.objects.bulk_create(objects['levels'], batch_size=BATCH_SIZE)
        if objects['location_groups']:
            LocationGroup.objects.bulk_create(objects['location_groups'], batch_size=BATCH_SIZE)
        if objects['booking_rules']:
            BookingRule.objects.bulk_create(objects['booking_rules'], batch_size=BATCH_SIZE)
        if objects['attributions']:
            Attribution.objects.bulk_create(objects['attributions'], batch_size=BATCH_SIZE)
        if objects['timeframes']:
            Timeframe.objects.bulk_create(objects['timeframes'], batch_size=BATCH_SIZE)
        if objects['rider_categories']:
            RiderCategory.objects.bulk_create(objects['rider_categories'], batch_size=BATCH_SIZE)
        if objects['fare_media']:
            FareMedia.objects.bulk_create(objects['fare_media'], batch_size=BATCH_SIZE)
        if objects['fare_products']:
            FareProduct.objects.bulk_create(objects['fare_products'], batch_size=BATCH_SIZE)
        if objects['fare_leg_rules']:
            FareLegRule.objects.bulk_create(objects['fare_leg_rules'], batch_size=BATCH_SIZE)
        if objects['fare_leg_join_rules']:
            FareLegJoinRule.objects.bulk_create(objects['fare_leg_join_rules'], batch_size=BATCH_SIZE)
        if objects['fare_transfer_rules']:
            FareTransferRule.objects.bulk_create(objects['fare_transfer_rules'], batch_size=BATCH_SIZE)
        if objects['areas']:
            Area.objects.bulk_create(objects['areas'], batch_size=BATCH_SIZE)
        if objects['stop_areas']:
            StopArea.objects.bulk_create(objects['stop_areas'], batch_size=BATCH_SIZE)
        if objects['networks']:
            Network.objects.bulk_create(objects['networks'], batch_size=BATCH_SIZE)
        if objects['route_networks']:
            RouteNetwork.objects.bulk_create(objects['route_networks'], batch_size=BATCH_SIZE)

        # Fares (optional) — insert after collecting warnings
        if objects.get('fare_attributes'):
            FareAttribute.objects.bulk_create(objects['fare_attributes'], batch_size=BATCH_SIZE)

        # Parse fare_rules -> resolve to FK after attributes are present
        if objects.get('fare_rules'):
            pending_rules = objects['fare_rules']
            fare_ids = sorted({r['fare_id'] for r in pending_rules if r.get('fare_id')})
            id_map = dict(
                FareAttribute.objects
                .filter(scenario=self.scenario, fare_id__in=fare_ids)
                .values_list('fare_id', 'id')
            )
            rule_objs = []
            for r in pending_rules:
                fk = id_map.get(r['fare_id'])
                if not fk:
                    log_json(
                        logger,
                        logging.WARNING,
                        "fare_rules_unknown_fare_id",
                        scenario_id=str(self.scenario.id),
                        fare_id=r['fare_id'],
                    )
                    continue
                rule_objs.append(FareRule(
                    scenario=self.scenario,
                    fare_attribute_id=fk,
                    fare_id=r.get('fare_id', ''),
                    route_id=r.get('route_id', ''),
                    origin_id=r.get('origin_id', ''),
                    destination_id=r.get('destination_id', ''),
                    contains_id=r.get('contains_id', ''),
                ))
            if rule_objs:
                FareRule.objects.bulk_create(rule_objs, batch_size=BATCH_SIZE)

        # Resolve location_group_stops pending rows (need FK to LocationGroup)
        if objects['location_group_stops_pending']:
            log_json(
                logger,
                logging.DEBUG,
                "resolving_location_group_stop_fks",
                scenario_id=str(self.scenario.id),
            )
            pending = objects['location_group_stops_pending']
            lg_ids = sorted({row['location_group_id'] for row in pending})
            lg_map = dict(
                LocationGroup.objects
                .filter(scenario=self.scenario, location_group_id__in=lg_ids)
                .values_list('location_group_id', 'id')
            )
            lgs_to_create = []
            for row in pending:
                lg_pk = lg_map.get(row['location_group_id'])
                if not lg_pk:
                    log_json(
                        logger,
                        logging.WARNING,
                        "location_group_stops_unknown_group_id",
                        scenario_id=str(self.scenario.id),
                        location_group_id=row['location_group_id'],
                    )
                    continue
                lgs_to_create.append(
                    LocationGroupStop(
                        scenario=self.scenario,
                        location_group_id=lg_pk,
                        stop_id=row['stop_id'],
                    )
                )
            if lgs_to_create:
                LocationGroupStop.objects.bulk_create(lgs_to_create, batch_size=BATCH_SIZE)

        # Post processing
        ShapeGenerator.process_create_shapes_all_data(self.scenario.id)
        StopDataStandardizer.process_grouping_stop_name_data(self.scenario.id)
        StopDataStandardizer.process_grouping_stop_id_data(self.scenario.id)
        update_scenario_region_and_prefecture(self.scenario.id) 
        process_gtfs_df(self.scenario)

        try:
            DirectionIDGenerator(self.scenario.id).generate_direction_id()
        except Exception as e:
            # ✅ FIXED: Now using consistent error format
            return [self._err(
                source="internal",
                code="direction_id_generation_error",
                message="Direction ID生成中にエラーが発生しました。",
                details={"error": str(e)}
            )]

        # Return warnings if any (import successful but with warnings)
        if warning_errors:
            log_json(
                logger,
                logging.DEBUG,
                "import_success_with_warnings",
                scenario_id=str(self.scenario.id),
                warning_count=len(warning_errors),
            )
            return {
                'status': 'success_with_warnings',
                'warnings': warning_errors
            }
        
        log_json(
            logger,
            logging.DEBUG,
            "import_complete_success",
            scenario_id=str(self.scenario.id),
        )
        # Complete success - no errors at all
        return None
    
    def process_stops_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_stop_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                stop_id = row.get("stop_id", "").strip()

                if stop_id in seen_stop_ids:
                    raise ValueError(f"stop_id '{stop_id}' は重複しています。")

                seen_stop_ids.add(stop_id)

                wheelchair_val = row.get("wheelchair_boarding", "").strip()
                wheelchair_boarding = None
                if wheelchair_val and wheelchair_val not in ("", " ", "None", "null"):
                    try:
                        wheelchair_boarding = int(wheelchair_val)
                    except (ValueError, TypeError):
                        wheelchair_boarding = None

                platform_code_raw = row.get("platform_code")
                if platform_code_raw is None:
                    platform_code = None
                else:
                    platform_code = platform_code_raw.strip()

                # NEW FIELDS (global/JP)
                tts_stop_name = (row.get("tts_stop_name") or "").strip()
                stop_timezone = (row.get("stop_timezone") or "").strip()
                level_id = (row.get("level_id") or "").strip()
                stop_access_val = (row.get("stop_access") or "").strip()
                stop_access = None
                if stop_access_val not in ("", " ", None):
                    try:
                        stop_access = int(stop_access_val)
                    except:
                        stop_access = None

                obj = Stops(
                    scenario=self.scenario,
                    stop_id=stop_id,
                    stop_code=row.get("stop_code", "").strip(),
                    stop_name=row.get("stop_name", "").strip(),
                    stop_desc=row.get("stop_desc", "").strip(),
                    stop_lat=self.round_coord_6(row.get("stop_lat")),
                    stop_lon=self.round_coord_6(row.get("stop_lon")),
                    zone_id=row.get("zone_id", "").strip(),
                    stop_url=row.get("stop_url", "").strip(),
                    location_type=int(row.get("location_type") or 0),
                    parent_station=row.get("parent_station", "").strip(),
                    wheelchair_boarding=wheelchair_boarding,
                    platform_code=platform_code,
                    tts_stop_name=tts_stop_name,
                    stop_timezone=stop_timezone,
                    level_id=level_id,
                    stop_access=stop_access,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"stops.txt の行 {idx} でエラーが発生しました。",
                    file="stops.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"stops.txt の行 {idx} でエラーが発生しました。",
                    file="stops.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows

    def process_timeframes_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        def _time_or_none(v):
            v = (v or "").strip()
            if not v or v in ("None", "null"):
                return None
            try:
                return datetime.strptime(v, "%H:%M:%S").time()
            except ValueError:
                return None

        for idx, row in enumerate(reader, start=1):
            try:
                timeframe_group_id = (row.get("timeframe_group_id") or "").strip()
                service_id = (row.get("service_id") or "").strip()
                if not timeframe_group_id or not service_id:
                    raise ValueError("timeframe_group_id / service_id が空です")

                key = (timeframe_group_id, service_id,
                       (row.get("start_time") or "").strip(),
                       (row.get("end_time") or "").strip())
                if key in seen_keys:
                    raise ValueError(f"timeframe の組み合わせが重複しています: {key}")
                seen_keys.add(key)

                start_time = _time_or_none(row.get("start_time"))
                end_time = _time_or_none(row.get("end_time"))

                obj = Timeframe(
                    scenario=self.scenario,
                    timeframe_group_id=timeframe_group_id,
                    start_time=start_time,
                    end_time=end_time,
                    service_id=service_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"timeframes.txt の行 {idx} でエラーが発生しました",
                    file="timeframes.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"timeframes.txt の行 {idx} でエラーが発生しました",
                    file="timeframes.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_rider_categories_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                rider_category_id = (row.get("rider_category_id") or "").strip()
                rider_category_name = (row.get("rider_category_name") or "").strip()
                if not rider_category_id or not rider_category_name:
                    raise ValueError("rider_category_id / rider_category_name が空です")

                if rider_category_id in seen_ids:
                    raise ValueError(f"rider_category_id '{rider_category_id}' が重複しています")
                seen_ids.add(rider_category_id)

                is_default = (row.get("is_default_fare_category") or "").strip()
                is_default = int(is_default) if is_default not in ("", "None", "null") else None
                eligibility_url = (row.get("eligibility_url") or "").strip()

                obj = RiderCategory(
                    scenario=self.scenario,
                    rider_category_id=rider_category_id,
                    rider_category_name=rider_category_name,
                    is_default_fare_category=is_default,
                    eligibility_url=eligibility_url,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"rider_categories.txt の行 {idx} でエラーが発生しました",
                    file="rider_categories.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"rider_categories.txt の行 {idx} でエラーが発生しました",
                    file="rider_categories.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_fare_media_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                fare_media_id = (row.get("fare_media_id") or "").strip()
                if not fare_media_id:
                    raise ValueError("fare_media_id が空です")

                if fare_media_id in seen_ids:
                    raise ValueError(f"fare_media_id '{fare_media_id}' が重複しています")
                seen_ids.add(fare_media_id)

                fare_media_name = (row.get("fare_media_name") or "").strip()
                fare_media_type_raw = (row.get("fare_media_type") or "").strip()
                if not fare_media_type_raw:
                    raise ValueError("fare_media_type が空です")
                fare_media_type = int(fare_media_type_raw)

                obj = FareMedia(
                    scenario=self.scenario,
                    fare_media_id=fare_media_id,
                    fare_media_name=fare_media_name,
                    fare_media_type=fare_media_type,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"fare_media.txt の行 {idx} でエラーが発生しました",
                    file="fare_media.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"fare_media.txt の行 {idx} でエラーが発生しました",
                    file="fare_media.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_fare_products_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                fare_product_id = (row.get("fare_product_id") or "").strip()
                if not fare_product_id:
                    raise ValueError("fare_product_id が空です")

                if fare_product_id in seen_ids:
                    raise ValueError(f"fare_product_id '{fare_product_id}' が重複しています")
                seen_ids.add(fare_product_id)

                fare_product_name = (row.get("fare_product_name") or "").strip()
                rider_category_id = (row.get("rider_category_id") or "").strip()
                fare_media_id = (row.get("fare_media_id") or "").strip()

                amount_raw = (row.get("amount") or "").strip()
                currency = (row.get("currency") or "").strip()
                if not amount_raw or not currency:
                    raise ValueError("amount / currency が空です")

                amount = Decimal(amount_raw)

                obj = FareProduct(
                    scenario=self.scenario,
                    fare_product_id=fare_product_id,
                    fare_product_name=fare_product_name,
                    rider_category_id=rider_category_id,
                    fare_media_id=fare_media_id,
                    amount=amount,
                    currency=currency,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except (InvalidOperation, ValueError) as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"fare_products.txt の行 {idx} でエラーが発生しました",
                    file="fare_products.txt",
                    row=idx,
                    details={"error": str(e)},
                ))
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"fare_products.txt の行 {idx} でエラーが発生しました",
                    file="fare_products.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"fare_products.txt の行 {idx} でエラーが発生しました",
                    file="fare_products.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_fare_leg_rules_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                network_id = (row.get("network_id") or "").strip()
                from_area_id = (row.get("from_area_id") or "").strip()
                to_area_id = (row.get("to_area_id") or "").strip()
                from_tf = (row.get("from_timeframe_group_id") or "").strip()
                to_tf = (row.get("to_timeframe_group_id") or "").strip()
                fare_product_id = (row.get("fare_product_id") or "").strip()
                if not fare_product_id:
                    raise ValueError("fare_product_id が空です")

                key = (network_id, from_area_id, to_area_id, from_tf, to_tf, fare_product_id)
                if key in seen_keys:
                    raise ValueError(f"fare_leg_rules のキーが重複しています: {key}")
                seen_keys.add(key)

                leg_group_id = (row.get("leg_group_id") or "").strip()
                rule_priority_raw = (row.get("rule_priority") or "").strip()
                rule_priority = int(rule_priority_raw) if rule_priority_raw not in ("", "None", "null") else None

                obj = FareLegRule(
                    scenario=self.scenario,
                    leg_group_id=leg_group_id,
                    network_id=network_id,
                    from_area_id=from_area_id,
                    to_area_id=to_area_id,
                    from_timeframe_group_id=from_tf,
                    to_timeframe_group_id=to_tf,
                    fare_product_id=fare_product_id,
                    rule_priority=rule_priority,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"fare_leg_rules.txt の行 {idx} でエラーが発生しました",
                    file="fare_leg_rules.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"fare_leg_rules.txt の行 {idx} でエラーが発生しました",
                    file="fare_leg_rules.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_fare_leg_join_rules_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                from_network_id = (row.get("from_network_id") or "").strip()
                to_network_id = (row.get("to_network_id") or "").strip()
                if not from_network_id or not to_network_id:
                    raise ValueError("from_network_id / to_network_id が空です")

                key = (from_network_id, to_network_id,
                       (row.get("from_stop_id") or "").strip(),
                       (row.get("to_stop_id") or "").strip())
                if key in seen_keys:
                    raise ValueError(f"fare_leg_join_rules のキーが重複しています: {key}")
                seen_keys.add(key)

                obj = FareLegJoinRule(
                    scenario=self.scenario,
                    from_network_id=from_network_id,
                    to_network_id=to_network_id,
                    from_stop_id=(row.get("from_stop_id") or "").strip(),
                    to_stop_id=(row.get("to_stop_id") or "").strip(),
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"fare_leg_join_rules.txt の行 {idx} でエラーが発生しました",
                    file="fare_leg_join_rules.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"fare_leg_join_rules.txt の行 {idx} でエラーが発生しました",
                    file="fare_leg_join_rules.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_fare_transfer_rules_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        def _int_or_none(v):
            v = (v or "").strip()
            if not v or v in ("None", "null"):
                return None
            try:
                return int(v)
            except Exception:
                return None

        for idx, row in enumerate(reader, start=1):
            try:
                from_leg_group_id = (row.get("from_leg_group_id") or "").strip()
                to_leg_group_id = (row.get("to_leg_group_id") or "").strip()
                transfer_count = _int_or_none(row.get("transfer_count"))
                duration_limit = _int_or_none(row.get("duration_limit"))
                duration_limit_type = _int_or_none(row.get("duration_limit_type"))

                fare_transfer_type_raw = (row.get("fare_transfer_type") or "").strip()
                if fare_transfer_type_raw in ("", "None", "null"):
                    raise ValueError("fare_transfer_type が空です")
                fare_transfer_type = int(fare_transfer_type_raw)

                fare_product_id = (row.get("fare_product_id") or "").strip()

                key = (from_leg_group_id, to_leg_group_id, fare_product_id, transfer_count, duration_limit)
                if key in seen_keys:
                    raise ValueError(f"fare_transfer_rules のキーが重複しています: {key}")
                seen_keys.add(key)

                obj = FareTransferRule(
                    scenario=self.scenario,
                    from_leg_group_id=from_leg_group_id,
                    to_leg_group_id=to_leg_group_id,
                    transfer_count=transfer_count,
                    duration_limit=duration_limit,
                    duration_limit_type=duration_limit_type,
                    fare_transfer_type=fare_transfer_type,
                    fare_product_id=fare_product_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"fare_transfer_rules.txt の行 {idx} でエラーが発生しました",
                    file="fare_transfer_rules.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"fare_transfer_rules.txt の行 {idx} でエラーが発生しました",
                    file="fare_transfer_rules.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_areas_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                area_id = (row.get("area_id") or "").strip()
                if not area_id:
                    raise ValueError("area_id が空です")
                if area_id in seen_ids:
                    raise ValueError(f"area_id '{area_id}' が重複しています")
                seen_ids.add(area_id)

                area_name = (row.get("area_name") or "").strip()

                obj = Area(
                    scenario=self.scenario,
                    area_id=area_id,
                    area_name=area_name,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"areas.txt の行 {idx} でエラーが発生しました",
                    file="areas.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"areas.txt の行 {idx} でエラーが発生しました",
                    file="areas.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_stop_areas_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                area_id = (row.get("area_id") or "").strip()
                stop_id = (row.get("stop_id") or "").strip()
                if not area_id or not stop_id:
                    raise ValueError("area_id / stop_id が空です")

                key = (area_id, stop_id)
                if key in seen_keys:
                    raise ValueError(f"stop_areas のキーが重複しています: {key}")
                seen_keys.add(key)

                obj = StopArea(
                    scenario=self.scenario,
                    area_id=area_id,
                    stop_id=stop_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"stop_areas.txt の行 {idx} でエラーが発生しました",
                    file="stop_areas.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"stop_areas.txt の行 {idx} でエラーが発生しました",
                    file="stop_areas.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_networks_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                network_id = (row.get("network_id") or "").strip()
                if not network_id:
                    raise ValueError("network_id が空です")
                if network_id in seen_ids:
                    raise ValueError(f"network_id '{network_id}' が重複しています")
                seen_ids.add(network_id)

                network_name = (row.get("network_name") or "").strip()

                obj = Network(
                    scenario=self.scenario,
                    network_id=network_id,
                    network_name=network_name,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"networks.txt の行 {idx} でエラーが発生しました",
                    file="networks.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"networks.txt の行 {idx} でエラーが発生しました",
                    file="networks.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_route_networks_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                network_id = (row.get("network_id") or "").strip()
                route_id = (row.get("route_id") or "").strip()
                if not network_id or not route_id:
                    raise ValueError("network_id / route_id が空です")

                key = (network_id, route_id)
                if key in seen_keys:
                    raise ValueError(f"route_networks のキーが重複しています: {key}")
                seen_keys.add(key)

                obj = RouteNetwork(
                    scenario=self.scenario,
                    network_id=network_id,
                    route_id=route_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"route_networks.txt の行 {idx} でエラーが発生しました",
                    file="route_networks.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"route_networks.txt の行 {idx} でエラーが発生しました",
                    file="route_networks.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    
    def process_routes_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_route_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                route_id = row.get("route_id", "").strip()

                if route_id in seen_route_ids:
                    raise ValueError(f"route_id '{route_id}' は重複しています。")

                seen_route_ids.add(route_id)

                route_short_name = row.get("route_short_name", "").strip()
                route_long_name = row.get("route_long_name", "").strip()
                if not route_short_name and not route_long_name:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=f"routes.txt の行 {idx} でエラーが発生しました。",
                        file="routes.txt",
                        row=idx,
                        details={"error": "route_short_name と route_long_name の両方が空です。"}
                    ))

                # NEW FIELDS
                route_sort_order_val = (row.get("route_sort_order") or "").strip()
                route_sort_order = None
                if route_sort_order_val not in ("", " "):
                    try:
                        route_sort_order = int(route_sort_order_val)
                    except:
                        route_sort_order = None

                continuous_pickup = (row.get("continuous_pickup") or "").strip()
                continuous_drop_off = (row.get("continuous_drop_off") or "").strip()
                network_id = (row.get("network_id") or "").strip()
                jp_parent_route_id = (row.get("jp_parent_route_id") or "").strip()

                cemv_val = (row.get("cemv_support") or "").strip()
                cemv_support = None
                if cemv_val.lower() in ("1", "true", "yes"):
                    cemv_support = True
                elif cemv_val.lower() in ("0", "false", "no"):
                    cemv_support = False

                obj = Routes(
                    scenario=self.scenario,
                    route_id=route_id,
                    route_short_name=route_short_name,
                    route_long_name=route_long_name,
                    agency_id=row.get("agency_id", "").strip(),
                    route_desc=row.get("route_desc", "").strip(),
                    route_type=int(row.get("route_type") or 3),
                    route_url=row.get("route_url", "").strip(),
                    route_color=row.get("route_color", "").strip(),
                    route_text_color=row.get("route_text_color", "").strip(),
                    route_sort_order=route_sort_order,
                    continuous_pickup=int(continuous_pickup) if continuous_pickup.isdigit() else None,
                    continuous_drop_off=int(continuous_drop_off) if continuous_drop_off.isdigit() else None,
                    network_id=network_id,
                    cemv_support=cemv_support,
                    jp_parent_route_id=jp_parent_route_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"routes.txt の行 {idx} でエラーが発生しました。",
                    file="routes.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"routes.txt の行 {idx} でエラーが発生しました。",
                    file="routes.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows


    def process_shapes_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_shape_sequences = set()

        for idx, row in enumerate(reader, start=1):
            try:
                shape_id = row.get("shape_id", "").strip()
                shape_pt_sequence = int(row.get("shape_pt_sequence", 0))

                shape_key = (shape_id, shape_pt_sequence)
                if shape_key in seen_shape_sequences:
                    raise ValueError(f"shape_id '{shape_id}' と shape_pt_sequence '{shape_pt_sequence}' は重複しています。")

                seen_shape_sequences.add(shape_key)

                dist_val = row.get("shape_dist_traveled", "").strip()
                shape_dist_traveled = None
                if dist_val and dist_val not in ("", " ", "None", "null"):
                    try:
                        shape_dist_traveled = float(dist_val)
                    except:
                        shape_dist_traveled = None

                obj = Shape(
                    scenario=self.scenario,
                    shape_id=shape_id,
                    shape_pt_lat=float(row.get("shape_pt_lat", 0)),
                    shape_pt_lon=float(row.get("shape_pt_lon", 0)),
                    shape_pt_sequence=shape_pt_sequence,
                    shape_dist_traveled=shape_dist_traveled
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"shapes.txt の行 {idx} でエラーが発生しました。",
                    file="shapes.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"shapes.txt の行 {idx} でエラーが発生しました。",
                    file="shapes.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows

    def process_trips_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_trip_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                trip_id = row.get("trip_id", "").strip()

                if trip_id in seen_trip_ids:
                    raise ValueError(f"trip_id '{trip_id}' は重複しています。")

                seen_trip_ids.add(trip_id)

                direction_raw = row.get("direction_id")
                direction_id = None
                if direction_raw not in (None, "", " ", "None", "null"):
                    try:
                        direction_id = int(direction_raw)
                    except (ValueError, TypeError):
                        direction_id = None

                wheelchair_raw = (row.get("wheelchair_accessible") or "").strip()
                bikes_raw = (row.get("bikes_allowed") or "").strip()
                cars_raw = (row.get("cars_allowed") or "").strip()

                wheelchair_accessible = None
                bikes_allowed = None
                cars_allowed = None

                if wheelchair_raw not in ("", " ", "None", "null"):
                    try:
                        wheelchair_accessible = int(wheelchair_raw)
                    except:
                        wheelchair_accessible = None
                if bikes_raw not in ("", " ", "None", "null"):
                    try:
                        bikes_allowed = int(bikes_raw)
                    except:
                        bikes_allowed = None
                if cars_raw not in ("", " ", "None", "null"):
                    try:
                        cars_allowed = int(cars_raw)
                    except:
                        cars_allowed = None

                jp_trip_desc = (row.get("jp_trip_desc") or "").strip()
                jp_trip_desc_symbol = (row.get("jp_trip_desc_symbol") or "").strip()
                jp_office_id = (row.get("jp_office_id") or "").strip()
                jp_pattern_id = (row.get("jp_pattern_id") or "").strip()

                obj = Trips(
                    scenario=self.scenario,
                    trip_id=trip_id,
                    route_id=row.get("route_id", "").strip(),
                    service_id=row.get("service_id", "").strip(),
                    trip_headsign=row.get("trip_headsign", "").strip(),
                    trip_short_name=row.get("trip_short_name", "").strip(),
                    direction_id=direction_id,
                    block_id=row.get("block_id", "").strip(),
                    shape_id=row.get("shape_id", "").strip(),
                    wheelchair_accessible=wheelchair_accessible,
                    bikes_allowed=bikes_allowed,
                    cars_allowed=cars_allowed,
                    jp_trip_desc=jp_trip_desc,
                    jp_trip_desc_symbol=jp_trip_desc_symbol,
                    jp_office_id=jp_office_id,
                    jp_pattern_id=jp_pattern_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"trips.txt の行 {idx} でエラーが発生しました。",
                    file="trips.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"trips.txt の行 {idx} でエラーが発生しました。",
                    file="trips.txt",
                    row=idx,
                    details={"error": str(e)}
                ))
        return objects_to_create, error_rows


    def process_stop_times_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_trip_sequences = set()

        for idx, row in enumerate(reader, start=1):
            try:
                trip_id = row.get("trip_id", "").strip()
                stop_sequence = int(row.get("stop_sequence", 0))

                trip_stop_key = (trip_id, stop_sequence)
                if trip_stop_key in seen_trip_sequences:
                    raise ValueError(f"trip_id '{trip_id}' と stop_sequence '{stop_sequence}' の組み合わせは重複しています。")

                seen_trip_sequences.add(trip_stop_key)

                arrival_time_str = row.get("arrival_time", "").strip()
                arrival_time = None
                is_arrival_time_next_day = False
                if arrival_time_str:
                    try:
                        arrival_time, is_arrival_time_next_day = self._parse_gtfs_time(arrival_time_str)
                    except ValueError:
                        arrival_time = None
                        is_arrival_time_next_day = False

                departure_time_str = row.get("departure_time", "").strip()
                departure_time = None
                is_departure_time_next_day = False
                if departure_time_str:
                    try:
                        departure_time, is_departure_time_next_day = self._parse_gtfs_time(departure_time_str)
                    except ValueError:
                        departure_time = None
                        is_departure_time_next_day = False

                dist_val = row.get("shape_dist_traveled", "").strip()
                shape_dist_traveled = None
                if dist_val and dist_val not in ("", " ", "None", "null"):
                    try:
                        shape_dist_traveled = float(dist_val)
                    except (ValueError, TypeError):
                        shape_dist_traveled = None

                timepoint_val = row.get("timepoint", "").strip()
                timepoint = None
                if timepoint_val and timepoint_val not in ("", " ", "None", "null"):
                    try:
                        timepoint = int(timepoint_val)
                    except (ValueError, TypeError):
                        timepoint = None

                # NEW FIELDS (flex / location groups / booking)
                location_group_id = (row.get("location_group_id") or "").strip()
                location_id = (row.get("location_id") or "").strip()

                start_pickup_drop_off_window = None
                end_pickup_drop_off_window = None

                start_window_raw = (row.get("start_pickup_drop_off_window") or "").strip()
                end_window_raw = (row.get("end_pickup_drop_off_window") or "").strip()

                if start_window_raw:
                    try:
                        start_pickup_drop_off_window = datetime.strptime(start_window_raw, "%H:%M:%S").time()
                    except ValueError:
                        start_pickup_drop_off_window = None

                if end_window_raw:
                    try:
                        end_pickup_drop_off_window = datetime.strptime(end_window_raw, "%H:%M:%S").time()
                    except ValueError:
                        end_pickup_drop_off_window = None

                continuous_pickup_val = (row.get("continuous_pickup") or "").strip()
                continuous_drop_off_val = (row.get("continuous_drop_off") or "").strip()

                continuous_pickup = None
                continuous_drop_off = None
                if continuous_pickup_val not in ("", " ", "None", "null"):
                    try:
                        continuous_pickup = int(continuous_pickup_val)
                    except:
                        continuous_pickup = None
                if continuous_drop_off_val not in ("", " ", "None", "null"):
                    try:
                        continuous_drop_off = int(continuous_drop_off_val)
                    except:
                        continuous_drop_off = None

                pickup_booking_rule_id = (row.get("pickup_booking_rule_id") or "").strip()
                drop_off_booking_rule_id = (row.get("drop_off_booking_rule_id") or "").strip()

                obj = StopTimes(
                    scenario=self.scenario,
                    trip_id=trip_id,
                    arrival_time=arrival_time,
                    departure_time=departure_time,
                    stop_id=row.get("stop_id", "").strip(),
                    stop_sequence=stop_sequence,
                    stop_headsign=row.get("stop_headsign", "").strip(),
                    pickup_type=int(row.get("pickup_type") or 0),
                    drop_off_type=int(row.get("drop_off_type") or 0),
                    shape_dist_traveled=shape_dist_traveled,
                    timepoint=timepoint,
                    is_arrival_time_next_day=is_arrival_time_next_day,
                    is_departure_time_next_day=is_departure_time_next_day,
                    location_group_id=location_group_id,
                    location_id=location_id,
                    start_pickup_drop_off_window=start_pickup_drop_off_window,
                    end_pickup_drop_off_window=end_pickup_drop_off_window,
                    continuous_pickup=continuous_pickup,
                    continuous_drop_off=continuous_drop_off,
                    pickup_booking_rule_id=pickup_booking_rule_id,
                    drop_off_booking_rule_id=drop_off_booking_rule_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"stop_times.txt の行 {idx} でエラーが発生しました。",
                    file="stop_times.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"stop_times.txt の行 {idx} でエラーが発生しました。",
                    file="stop_times.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows

    def process_calendar_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        objects_to_create = []

        seen_service_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                service_id = row.get("service_id", "").strip()

                if service_id in seen_service_ids:
                    raise ValueError(f"service_id '{service_id}' は重複しています。")

                seen_service_ids.add(service_id)

                obj = Calendar(
                    scenario=self.scenario,
                    service_id=service_id,
                    monday=int(row.get("monday") or 0),
                    tuesday=int(row.get("tuesday") or 0),
                    wednesday=int(row.get("wednesday") or 0),
                    thursday=int(row.get("thursday") or 0),
                    friday=int(row.get("friday") or 0),
                    saturday=int(row.get("saturday") or 0),
                    sunday=int(row.get("sunday") or 0),
                    start_date=row.get("start_date", "").strip(),
                    end_date=row.get("end_date", "").strip()
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"calendar.txt の行 {idx} でエラーが発生しました。",
                    file="calendar.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"calendar.txt の行 {idx} でエラーが発生しました。",
                    file="calendar.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows


    def process_calendar_dates_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_service_dates = set()

        for idx, row in enumerate(reader, start=1):
            try:
                service_id = row.get("service_id", "").strip()
                date = row.get("date", "").strip()

                service_date_key = (service_id, date)
                if service_date_key in seen_service_dates:
                    raise ValueError(f"service_id '{service_id}' と date '{date}' の組み合わせは重複しています。")

                seen_service_dates.add(service_date_key)

                obj = CalendarDates(
                    scenario=self.scenario,
                    service_id=service_id,
                    date=date,
                    exception_type=int(row.get("exception_type") or 1)
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"calendar_dates.txt の行 {idx} でエラーが発生しました。",
                    file="calendar_dates.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"calendar_dates.txt の行 {idx} でエラーが発生しました。",
                    file="calendar_dates.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows

    def process_agency_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []

        seen_agency_ids = set()

        for idx, row in enumerate(reader, start=1):
            try:
                agency_id = row.get("agency_id", "").strip()

                if agency_id in seen_agency_ids:
                    raise ValueError(f"agency_id '{agency_id}' は重複しています。")

                seen_agency_ids.add(agency_id)

                agency_email = (row.get("agency_email") or "").strip()
                cemv_val = (row.get("cemv_support") or "").strip()
                cemv_support = None
                if cemv_val.lower() in ("1", "true", "yes"):
                    cemv_support = True
                elif cemv_val.lower() in ("0", "false", "no"):
                    cemv_support = False

                obj = Agency(
                    agency_id=agency_id,
                    agency_name=row.get("agency_name", "").strip(),
                    agency_url=row.get("agency_url", "").strip(),
                    agency_timezone=row.get("agency_timezone", "").strip(),
                    agency_lang=row.get("agency_lang", "").strip(),
                    agency_phone=row.get("agency_phone", "").strip(),
                    agency_fare_url=row.get("agency_fare_url", "").strip(),
                    agency_email=agency_email,
                    cemv_support=cemv_support,
                    scenario=self.scenario
                )
                obj.full_clean()
                objects_to_create.append(obj)
            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"agency.txt の行 {idx} でエラーが発生しました。",
                    file="agency.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"agency.txt の行 {idx} でエラーが発生しました。",
                    file="agency.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows
    
    def process_feed_info_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        reader.fieldnames = [h.strip() for h in reader.fieldnames]

        objects_to_create, error_rows = [], []

        min_start_date = None
        max_end_date = None

        for idx, row in enumerate(reader, start=1):
            try:
                publisher_name = (row.get("feed_publisher_name") or "").strip()
                publisher_url = (row.get("feed_publisher_url") or "").strip()
                language = (row.get("feed_lang") or "").strip()
                version = (row.get("feed_version") or "").strip()

                s = (row.get("feed_start_date") or "").strip()
                e = (row.get("feed_end_date") or "").strip()
                if not s or not e:
                    raise ValueError("feed_start_date / feed_end_date が空です。")
                start_date = datetime.strptime(s, "%Y%m%d").date()
                end_date = datetime.strptime(e, "%Y%m%d").date()

                if min_start_date is None or start_date < min_start_date:
                    min_start_date = start_date
                if max_end_date is None or end_date > max_end_date:
                    max_end_date = end_date

                default_lang = (row.get("default_lang") or "").strip()
                feed_contact_email = (row.get("feed_contact_email") or "").strip()
                feed_contact_url = (row.get("feed_contact_url") or "").strip()

                obj = FeedInfo(
                    feed_publisher_name=publisher_name,
                    feed_publisher_url=publisher_url,
                    feed_lang=language,
                    feed_start_date=start_date,
                    feed_end_date=end_date,
                    feed_version=version,
                    scenario=self.scenario,
                    default_lang=default_lang,
                    feed_contact_email=feed_contact_email,
                    feed_contact_url=feed_contact_url,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"feed_info.txt の行 {idx} でエラーが発生しました。",
                    file="feed_info.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"feed_info.txt の行 {idx} でエラーが発生しました。",
                    file="feed_info.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows, {"start_date": min_start_date, "end_date": max_end_date}

    def process_translations_file(self, file):
        decoded = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(
            decoded,
            quotechar="|",
            escapechar="\\",
            doublequote=False,
        )
        reader.fieldnames = [(h or "").strip() for h in (reader.fieldnames or [])]

        has_spec_cols = any(h in reader.fieldnames for h in ["record_id", "record_sub_id"])
        objects_to_create, error_rows = [], []


        for idx, row in enumerate(reader, start=1):
            try:
                table_name = (row.get("table_name") or "").strip()
                field_name = (row.get("field_name") or "").strip()
                language = (row.get("language") or "").strip()
                translation = (row.get("translation") or "").strip()
                field_value = (row.get("field_value") or row.get("record_value") or "").strip()

                route_id = trip_id = service_id = stop_id = shape_id = feed_info_id = ""
                record_id = record_sub_id = ""

                if has_spec_cols:
                    record_id = (row.get("record_id") or "").strip()
                    record_sub_id = (row.get("record_sub_id") or "").strip()

                    t = table_name.lower()
                    if t == "routes":
                        route_id = record_id
                    elif t == "trips":
                        trip_id = record_id
                    elif t == "stops":
                        stop_id = record_id
                    elif t == "stop_times":
                        trip_id = record_id
                        stop_id = (row.get("stop_id") or record_sub_id or "").strip()
                    elif t == "shapes":
                        shape_id = record_id
                    elif t == "feed_info":
                        feed_info_id = record_id
                else:
                    route_id = (row.get("route_id") or "").strip()
                    trip_id = (row.get("trip_id") or "").strip()
                    service_id = (row.get("service_id") or "").strip()
                    stop_id = (row.get("stop_id") or "").strip()
                    shape_id = (row.get("shape_id") or "").strip()
                    feed_info_id = (row.get("feed_info_id") or "").strip()

                    t = table_name.lower()
                    if t == "routes":
                        record_id = route_id
                    elif t == "trips":
                        record_id = trip_id
                    elif t == "stops":
                        record_id = stop_id
                    elif t == "stop_times":
                        record_id = trip_id
                        record_sub_id = stop_id
                    elif t == "calendar" or t == "calendar_dates":
                        record_id = service_id
                    elif t == "feed_info":
                        record_id = feed_info_id

                obj = Translation(
                    scenario=self.scenario,
                    table_name=table_name,
                    field_name=field_name,
                    field_value=field_value,
                    language=language,
                    translation=translation,
                    record_id=record_id,
                    record_sub_id=record_sub_id,
                    route_id=route_id,
                    trip_id=trip_id,
                    service_id=service_id,
                    stop_id=stop_id,
                    shape_id=shape_id,
                    feed_info_id=feed_info_id,
                )
                # obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"translations.txt の行 {idx} でエラーが発生しました。",
                    file="translations.txt",
                    row=idx,
                    details={"error": str(ve)}
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"translations.txt の行 {idx} でエラーが発生しました。",
                    file="translations.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return objects_to_create, error_rows



    def process_fare_attributes_file(self, file):
        decoded = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded)
        objs, warns = [], []

        for idx, row in enumerate(reader, start=1):
            try:
                fare_id = (row.get("fare_id") or "").strip()

                obj = FareAttribute(
                    scenario=self.scenario,
                    agency_id=(row.get("agency_id") or "").strip(),
                    fare_id=fare_id,
                    price=Decimal((row.get("price") or "0").strip() or "0"),
                    currency_type=(row.get("currency_type") or "").strip(),
                    payment_method=int(row['payment_method']) if row.get('payment_method') not in (None, "") else None,
                    transfers=int(row['transfers']) if row.get('transfers') not in (None, "") else None,
                    transfer_duration=int(row['transfer_duration']) if row.get('transfer_duration') not in (None, "") else None,
                )
                try:
                    obj.full_clean()
                except DjangoValidationError as ve:
                    warns.append(f"fare_attributes.txt row {idx}: validation warning: {ve}")
                objs.append(obj)
            except Exception as e:
                warns.append(f"fare_attributes.txt row {idx}: parse warning: {e}")
        return objs, warns


    def process_fare_rules_file(self, file):
        decoded = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded)
        rows, warns = [], []


        for idx, row in enumerate(reader, start=1):
            fare_id = (row.get('fare_id') or '').strip()
            if not fare_id:
                warns.append(f"fare_rules.txt row {idx}: empty fare_id -> skipped")
                continue

            route_id = (row.get('route_id') or '').strip()
            origin_id = (row.get('origin_id') or '').strip()
            destination_id = (row.get('destination_id') or '').strip()
            contains_id = (row.get('contains_id') or '').strip()

            rows.append({
                'fare_id': fare_id,
                'route_id': route_id,
                'origin_id': origin_id,
                'destination_id': destination_id,
                'contains_id': contains_id,
            })
        return rows, warns

    def process_agency_jp_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                agency_id = (row.get("agency_id") or "").strip()
                if not agency_id:
                    raise ValueError("agency_id が空です。")

                key = agency_id
                if key in seen_keys:
                    raise ValueError(f"agency_id '{agency_id}' は重複しています。")
                seen_keys.add(key)

                obj = AgencyJP(
                    scenario=self.scenario,
                    agency_id=agency_id,
                    agency_official_name=(row.get("agency_official_name") or "").strip(),
                    agency_zip_number=(row.get("agency_zip_number") or "").strip(),
                    agency_address=(row.get("agency_address") or "").strip(),
                    agency_president_pos=(row.get("agency_president_pos") or "").strip(),
                    agency_president_name=(row.get("agency_president_name") or "").strip(),
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"agency_jp.txt の行 {idx} でエラーが発生しました。",
                    file="agency_jp.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"agency_jp.txt の行 {idx} でエラーが発生しました。",
                    file="agency_jp.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_office_jp_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                office_id = (row.get("office_id") or "").strip()
                if not office_id:
                    raise ValueError("office_id が空です。")

                if office_id in seen_keys:
                    raise ValueError(f"office_id '{office_id}' は重複しています。")
                seen_keys.add(office_id)

                obj = OfficeJP(
                    scenario=self.scenario,
                    office_id=office_id,
                    office_name=(row.get("office_name") or "").strip(),
                    office_url=(row.get("office_url") or "").strip(),
                    office_phone=(row.get("office_phone") or "").strip(),
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"office_jp.txt の行 {idx} でエラーが発生しました。",
                    file="office_jp.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"office_jp.txt の行 {idx} でエラーが発生しました。",
                    file="office_jp.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_pattern_jp_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                jp_pattern_id = (row.get("jp_pattern_id") or "").strip()
                if not jp_pattern_id:
                    raise ValueError("jp_pattern_id が空です。")

                if jp_pattern_id in seen_keys:
                    raise ValueError(f"jp_pattern_id '{jp_pattern_id}' は重複しています。")
                seen_keys.add(jp_pattern_id)

                route_update_date = None
                rud_raw = (row.get("route_update_date") or "").strip()
                if rud_raw:
                    try:
                        route_update_date = datetime.strptime(rud_raw, "%Y%m%d").date()
                    except ValueError:
                        route_update_date = None

                obj = PatternJP(
                    scenario=self.scenario,
                    jp_pattern_id=jp_pattern_id,
                    route_update_date=route_update_date,
                    origin_stop=(row.get("origin_stop") or "").strip(),
                    via_stop=(row.get("via_stop") or "").strip(),
                    destination_stop=(row.get("destination_stop") or "").strip(),
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"pattern_jp.txt の行 {idx} でエラーが発生しました。",
                    file="pattern_jp.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"pattern_jp.txt の行 {idx} でエラーが発生しました。",
                    file="pattern_jp.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_frequencies_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                trip_id = (row.get("trip_id") or "").strip()
                if not trip_id:
                    raise ValueError("trip_id が空です。")

                start_time_raw = (row.get("start_time") or "").strip()
                end_time_raw = (row.get("end_time") or "").strip()
                if not start_time_raw or not end_time_raw:
                    raise ValueError("start_time / end_time が空です。")

                try:
                    start_time = datetime.strptime(start_time_raw, "%H:%M:%S").time()
                    end_time = datetime.strptime(end_time_raw, "%H:%M:%S").time()
                except ValueError as ve:
                    raise ValueError(f"start_time/end_time の形式が不正です: {ve}")

                headway_secs_raw = (row.get("headway_secs") or "").strip()
                if not headway_secs_raw:
                    raise ValueError("headway_secs が空です。")
                headway_secs = int(headway_secs_raw)

                exact_times_raw = (row.get("exact_times") or "").strip()
                exact_times = None
                if exact_times_raw not in ("", " ", "None", "null"):
                    try:
                        exact_times = int(exact_times_raw)
                    except:
                        exact_times = None

                key = (trip_id, start_time_raw, end_time_raw, headway_secs)
                if key in seen_keys:
                    raise ValueError(f"trip_id/start_time/end_time/headway_secs の組み合わせが重複しています: {key}")
                seen_keys.add(key)

                obj = Frequencies(
                    scenario=self.scenario,
                    trip_id=trip_id,
                    start_time=start_time,
                    end_time=end_time,
                    headway_secs=headway_secs,
                    exact_times=exact_times,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"frequencies.txt の行 {idx} でエラーが発生しました。",
                    file="frequencies.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"frequencies.txt の行 {idx} でエラーが発生しました。",
                    file="frequencies.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_transfers_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                from_stop_id = (row.get("from_stop_id") or "").strip()
                to_stop_id = (row.get("to_stop_id") or "").strip()

                if not from_stop_id or not to_stop_id:
                    raise ValueError("from_stop_id / to_stop_id が空です。")

                transfer_type_raw = (row.get("transfer_type") or "").strip()
                if not transfer_type_raw:
                    raise ValueError("transfer_type が空です。")
                transfer_type = int(transfer_type_raw)

                min_transfer_time_raw = (row.get("min_transfer_time") or "").strip()
                min_transfer_time = None
                if min_transfer_time_raw not in ("", " ", "None", "null"):
                    try:
                        min_transfer_time = int(min_transfer_time_raw)
                    except:
                        min_transfer_time = None

                from_route_id = (row.get("from_route_id") or "").strip()
                to_route_id = (row.get("to_route_id") or "").strip()
                from_trip_id = (row.get("from_trip_id") or "").strip()
                to_trip_id = (row.get("to_trip_id") or "").strip()

                key = (from_stop_id, to_stop_id, from_route_id, to_route_id, from_trip_id, to_trip_id)
                if key in seen_keys:
                    raise ValueError(f"transfers の組み合わせが重複しています: {key}")
                seen_keys.add(key)

                obj = Transfers(
                    scenario=self.scenario,
                    from_stop_id=from_stop_id,
                    to_stop_id=to_stop_id,
                    transfer_type=transfer_type,
                    min_transfer_time=min_transfer_time,
                    from_route_id=from_route_id,
                    to_route_id=to_route_id,
                    from_trip_id=from_trip_id,
                    to_trip_id=to_trip_id,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"transfers.txt の行 {idx} でエラーが発生しました。",
                    file="transfers.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"transfers.txt の行 {idx} でエラーが発生しました。",
                    file="transfers.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_pathways_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_pathways = set()

        for idx, row in enumerate(reader, start=1):
            try:
                pathway_id = (row.get("pathway_id") or "").strip()
                from_stop_id = (row.get("from_stop_id") or "").strip()
                to_stop_id = (row.get("to_stop_id") or "").strip()
                if not pathway_id or not from_stop_id or not to_stop_id:
                    raise ValueError("pathway_id / from_stop_id / to_stop_id が空です。")

                if pathway_id in seen_pathways:
                    raise ValueError(f"pathway_id '{pathway_id}' は重複しています。")
                seen_pathways.add(pathway_id)

                pathway_mode_raw = (row.get("pathway_mode") or "").strip()
                is_bidirectional_raw = (row.get("is_bidirectional") or "").strip()
                if not pathway_mode_raw:
                    raise ValueError("pathway_mode が空です。")
                if not is_bidirectional_raw:
                    raise ValueError("is_bidirectional が空です。")

                pathway_mode = int(pathway_mode_raw)
                is_bidirectional = int(is_bidirectional_raw)

                length_raw = (row.get("length") or "").strip()
                traversal_time_raw = (row.get("traversal_time") or "").strip()
                stair_count_raw = (row.get("stair_count") or "").strip()
                max_slope_raw = (row.get("max_slope") or "").strip()
                min_width_raw = (row.get("min_width") or "").strip()

                length = float(length_raw) if length_raw not in ("", " ", "None", "null") else None
                traversal_time = int(traversal_time_raw) if traversal_time_raw not in ("", " ", "None", "null") else None
                stair_count = int(stair_count_raw) if stair_count_raw not in ("", " ", "None", "null") else None
                max_slope = float(max_slope_raw) if max_slope_raw not in ("", " ", "None", "null") else None
                min_width = float(min_width_raw) if min_width_raw not in ("", " ", "None", "null") else None

                signposted_as = (row.get("signposted_as") or "").strip()
                reversed_signposted_as = (row.get("reversed_signposted_as") or "").strip()

                obj = Pathway(
                    scenario=self.scenario,
                    pathway_id=pathway_id,
                    from_stop_id=from_stop_id,
                    to_stop_id=to_stop_id,
                    pathway_mode=pathway_mode,
                    is_bidirectional=is_bidirectional,
                    length=length,
                    traversal_time=traversal_time,
                    stair_count=stair_count,
                    max_slope=max_slope,
                    min_width=min_width,
                    signposted_as=signposted_as,
                    reversed_signposted_as=reversed_signposted_as,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"pathways.txt の行 {idx} でエラーが発生しました。",
                    file="pathways.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"pathways.txt の行 {idx} でエラーが発生しました。",
                    file="pathways.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_levels_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_levels = set()

        for idx, row in enumerate(reader, start=1):
            try:
                level_id = (row.get("level_id") or "").strip()
                if not level_id:
                    raise ValueError("level_id が空です。")

                if level_id in seen_levels:
                    raise ValueError(f"level_id '{level_id}' は重複しています。")
                seen_levels.add(level_id)

                level_index_raw = (row.get("level_index") or "").strip()
                if not level_index_raw:
                    raise ValueError("level_index が空です。")
                level_index = float(level_index_raw)

                level_name = (row.get("level_name") or "").strip()

                obj = Level(
                    scenario=self.scenario,
                    level_id=level_id,
                    level_index=level_index,
                    level_name=level_name,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"levels.txt の行 {idx} でエラーが発生しました。",
                    file="levels.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"levels.txt の行 {idx} でエラーが発生しました。",
                    file="levels.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_location_groups_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_groups = set()

        for idx, row in enumerate(reader, start=1):
            try:
                location_group_id = (row.get("location_group_id") or "").strip()
                location_group_name = (row.get("location_group_name") or "").strip()

                if not location_group_id:
                    raise ValueError("location_group_id が空です。")
                if not location_group_name:
                    raise ValueError("location_group_name が空です。")

                if location_group_id in seen_groups:
                    raise ValueError(f"location_group_id '{location_group_id}' は重複しています。")
                seen_groups.add(location_group_id)

                obj = LocationGroup(
                    scenario=self.scenario,
                    location_group_id=location_group_id,
                    location_group_name=location_group_name,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"location_groups.txt の行 {idx} でエラーが発生しました。",
                    file="location_groups.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"location_groups.txt の行 {idx} でエラーが発生しました。",
                    file="location_groups.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_location_group_stops_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        pending_rows = []
        error_rows = []

        seen_keys = set()

        for idx, row in enumerate(reader, start=1):
            try:
                location_group_id = (row.get("location_group_id") or "").strip()
                stop_id = (row.get("stop_id") or "").strip()

                if not location_group_id or not stop_id:
                    raise ValueError("location_group_id / stop_id が空です。")

                key = (location_group_id, stop_id)
                if key in seen_keys:
                    raise ValueError(f"location_group_id '{location_group_id}' と stop_id '{stop_id}' の組み合わせは重複しています。")
                seen_keys.add(key)

                pending_rows.append({
                    "location_group_id": location_group_id,
                    "stop_id": stop_id,
                })

            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"location_group_stops.txt の行 {idx} でエラーが発生しました。",
                    file="location_group_stops.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return pending_rows, error_rows

    def process_booking_rules_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_rules = set()

        for idx, row in enumerate(reader, start=1):
            try:
                booking_rule_id = (row.get("booking_rule_id") or "").strip()
                if not booking_rule_id:
                    raise ValueError("booking_rule_id が空です。")

                if booking_rule_id in seen_rules:
                    raise ValueError(f"booking_rule_id '{booking_rule_id}' は重複しています。")
                seen_rules.add(booking_rule_id)

                booking_type_raw = (row.get("booking_type") or "").strip()
                if not booking_type_raw:
                    raise ValueError("booking_type が空です。")
                booking_type = int(booking_type_raw)

                def _int_or_none(v):
                    v = (v or "").strip()
                    if not v or v in ("None", "null"):
                        return None
                    try:
                        return int(v)
                    except:
                        return None

                def _time_or_none(v):
                    v = (v or "").strip()
                    if not v or v in ("None", "null"):
                        return None
                    try:
                        return datetime.strptime(v, "%H:%M:%S").time()
                    except ValueError:
                        return None

                prior_notice_duration_min = _int_or_none(row.get("prior_notice_duration_min"))
                prior_notice_duration_max = _int_or_none(row.get("prior_notice_duration_max"))
                prior_notice_start_day = _int_or_none(row.get("prior_notice_start_day"))
                prior_notice_start_time = _time_or_none(row.get("prior_notice_start_time"))
                prior_notice_last_day = _int_or_none(row.get("prior_notice_last_day"))
                prior_notice_last_time = _time_or_none(row.get("prior_notice_last_time"))
                prior_notice_service_id = (row.get("prior_notice_service_id") or "").strip()

                message = (row.get("message") or "").strip()
                pickup_message = (row.get("pickup_message") or "").strip()
                drop_off_message = (row.get("drop_off_message") or "").strip()
                phone_number = (row.get("phone_number") or "").strip()
                info_url = (row.get("info_url") or "").strip()
                booking_url = (row.get("booking_url") or "").strip()

                obj = BookingRule(
                    scenario=self.scenario,
                    booking_rule_id=booking_rule_id,
                    booking_type=booking_type,
                    prior_notice_duration_min=prior_notice_duration_min,
                    prior_notice_duration_max=prior_notice_duration_max,
                    prior_notice_start_day=prior_notice_start_day,
                    prior_notice_start_time=prior_notice_start_time,
                    prior_notice_last_day=prior_notice_last_day,
                    prior_notice_last_time=prior_notice_last_time,
                    prior_notice_service_id=prior_notice_service_id,
                    message=message,
                    pickup_message=pickup_message,
                    drop_off_message=drop_off_message,
                    phone_number=phone_number,
                    info_url=info_url,
                    booking_url=booking_url,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"booking_rules.txt の行 {idx} でエラーが発生しました。",
                    file="booking_rules.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"booking_rules.txt の行 {idx} でエラーが発生しました。",
                    file="booking_rules.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows

    def process_attributions_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding="utf-8-sig")
        reader = csv.DictReader(decoded_file)

        objects_to_create = []
        error_rows = []
        seen_attributions = set()

        for idx, row in enumerate(reader, start=1):
            try:
                attribution_id = (row.get("attribution_id") or "").strip()
                if not attribution_id:
                    raise ValueError("attribution_id が空です。")

                if attribution_id in seen_attributions:
                    raise ValueError(f"attribution_id '{attribution_id}' は重複しています。")
                seen_attributions.add(attribution_id)

                organization_name = (row.get("organization_name") or "").strip()
                if not organization_name:
                    raise ValueError("organization_name が空です。")

                agency_id = (row.get("agency_id") or "").strip()
                route_id = (row.get("route_id") or "").strip()
                trip_id = (row.get("trip_id") or "").strip()

                def _int01_or_none(v):
                    v = (v or "").strip()
                    if not v or v in ("None", "null"):
                        return None
                    try:
                        return int(v)
                    except:
                        return None

                is_producer = _int01_or_none(row.get("is_producer"))
                is_operator = _int01_or_none(row.get("is_operator"))
                is_authority = _int01_or_none(row.get("is_authority"))

                attribution_url = (row.get("attribution_url") or "").strip()
                attribution_email = (row.get("attribution_email") or "").strip()
                attribution_phone = (row.get("attribution_phone") or "").strip()

                obj = Attribution(
                    scenario=self.scenario,
                    attribution_id=attribution_id,
                    agency_id=agency_id,
                    route_id=route_id,
                    trip_id=trip_id,
                    organization_name=organization_name,
                    is_producer=is_producer,
                    is_operator=is_operator,
                    is_authority=is_authority,
                    attribution_url=attribution_url,
                    attribution_email=attribution_email,
                    attribution_phone=attribution_phone,
                )
                obj.full_clean()
                objects_to_create.append(obj)

            except DjangoValidationError as ve:
                error_rows.append(self._err(
                    source="internal",
                    code="validation_error",
                    message=f"attributions.txt の行 {idx} でエラーが発生しました。",
                    file="attributions.txt",
                    row=idx,
                    details={"error": str(ve)},
                ))
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=f"attributions.txt の行 {idx} でエラーが発生しました。",
                    file="attributions.txt",
                    row=idx,
                    details={"error": str(e)},
                ))

        return objects_to_create, error_rows
