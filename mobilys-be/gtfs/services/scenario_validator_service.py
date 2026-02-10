import csv
import io
import logging
import zipfile
from datetime import datetime
from decimal import Decimal
from typing import Any

import requests
from django.core.files.base import ContentFile

from gtfs.models import Scenario
from gtfs.constants import ErrorMessages, ScenarioDeletionState
from gtfs.services.base import log_service_call
logger = logging.getLogger(__name__)


class GTFSValidator:
    """
    Validator for GTFS files without saving to database.
    Runs all the same validations as GTFSImporter for CORE files only.
    
    IMPORTANT: Optional files (fare_attributes.txt, fare_rules.txt, translations.txt)
    are NOT validated here. Their validation is handled by GTFSImporter with warning
    logic, allowing import to continue even if they have errors.
    
    This ensures users can proceed to import even if optional files have issues,
    with warnings displayed via notifications instead of blocking the import.
    """
    
    def _err(self, *, source, code, message, file=None, row=None, details=None):
        return {
            "source": source,
            "code": code,
            "message": str(message),
            "file": file,
            "row": row,
            "details": details or {},
        }

    def validate(self, zip_file, scenario_name=None):
        """
        Main validation method - returns list of errors (empty if valid)
        """
        required_files = [
            'routes.txt', 'trips.txt', 'stop_times.txt', 'agency.txt',
            'stops.txt', 'feed_info.txt'
        ]
        error_rows = []

        try:
            with zipfile.ZipFile(zip_file, 'r') as z:
                zip_contents = z.namelist()

                # 1. Validate required files
                missing_files = [f for f in required_files if f not in zip_contents]
                if missing_files:
                    return [self._err(
                        source="internal",
                        code="missing_required_files",
                        message=ErrorMessages.MISSING_REQUIRED_GTFS_FILES_JA,
                        file="zip",
                        details={"missing_files": missing_files},
                    )]

                # 2. Validate each file
                for file_name in zip_contents:
                    # Skip optional files - validation handled by GTFSImporter with warning logic
                    if file_name in ('fare_attributes.txt', 'fare_rules.txt', 'translations.txt'):
                        continue
                    if not file_name.endswith('.txt'):
                        continue

                    with z.open(file_name) as file:
                        if file_name == 'routes.txt':
                            errs = self._validate_routes_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'trips.txt':
                            errs = self._validate_trips_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'stop_times.txt':
                            errs = self._validate_stop_times_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'agency.txt':
                            errs = self._validate_agency_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'stops.txt':
                            errs = self._validate_stops_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'shapes.txt':
                            errs = self._validate_shapes_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'calendar.txt':
                            errs = self._validate_calendar_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'calendar_dates.txt':
                            errs = self._validate_calendar_dates_file(file)
                            error_rows.extend(errs)
                        elif file_name == 'feed_info.txt':
                            errs = self._validate_feed_info_file(file)
                            error_rows.extend(errs)
                        # translations.txt validation commented out - handled by warning logic
                        # elif file_name == 'translations.txt':
                        #     errs = self._validate_translations_file(file)
                        #     error_rows.extend(errs)

        except zipfile.BadZipFile:
            return [self._err(
                source="internal",
                code="invalid_zip",
                message=ErrorMessages.INVALID_ZIP_FILE_JA,
                file="zip",
                details={"error": "Bad zip file format"}
            )]
        except Exception as e:
            logger.exception("GTFS validation failed unexpectedly")
            return [self._err(
                source="internal",
                code="validation_exception",
                message=ErrorMessages.VALIDATION_PROCESSING_ERROR_JA,
                file="zip",
                details={"error": str(e)}
            )]

        return error_rows

    def _validate_stops_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                stop_id = row.get("stop_id", "").strip()
                if not stop_id:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                        file="stops.txt",
                        row=idx,
                        details={"error": "stop_id が必須です。"}
                    ))
                    continue
                
                # Validate lat/lon
                try:
                    lat_str = row.get("stop_lat", "").strip()
                    lon_str = row.get("stop_lon", "").strip()
                    
                    if not lat_str or not lon_str:
                        error_rows.append(self._err(
                            source="internal",
                            code="missing_field",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                            file="stops.txt",
                            row=idx,
                            details={"error": "stop_lat と stop_lon が必須です。"}
                        ))
                        continue
                    
                    lat = float(lat_str)
                    lon = float(lon_str)
                    
                    if lat < -90 or lat > 90:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_coordinate",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                            file="stops.txt",
                            row=idx,
                            details={"error": f"緯度 {lat} は-90から90の範囲である必要があります。"}
                        ))
                    if lon < -180 or lon > 180:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_coordinate",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                            file="stops.txt",
                            row=idx,
                            details={"error": f"経度 {lon} は-180から180の範囲である必要があります。"}
                        ))
                except (ValueError, TypeError) as e:
                    error_rows.append(self._err(
                        source="internal",
                        code="invalid_coordinate",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                        file="stops.txt",
                        row=idx,
                        details={"error": f"座標が無効です: {str(e)}"}
                    ))
                
                # Validate wheelchair_boarding if present
                wheelchair_val = row.get("wheelchair_boarding", "").strip()
                if wheelchair_val and wheelchair_val not in ("", " ", "None", "null"):
                    try:
                        wb = int(wheelchair_val)
                        if wb not in (0, 1, 2):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                                file="stops.txt",
                                row=idx,
                                details={"error": f"wheelchair_boarding '{wheelchair_val}' は 0, 1, 2 のいずれかである必要があります。"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                            file="stops.txt",
                            row=idx,
                            details={"error": f"wheelchair_boarding '{wheelchair_val}' は整数である必要があります。"}
                        ))
                
                # Validate location_type if present
                loc_type = row.get("location_type", "").strip()
                if loc_type:
                    try:
                        lt = int(loc_type)
                        if lt not in (0, 1, 2, 3, 4):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                                file="stops.txt",
                                row=idx,
                                details={"error": f"location_type '{loc_type}' は 0-4 の範囲である必要があります。"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                            file="stops.txt",
                            row=idx,
                            details={"error": f"location_type '{loc_type}' は整数である必要があります。"}
                        ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stops.txt の行 ", idx=idx),
                    file="stops.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_routes_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                route_id = row.get("route_id", "").strip()
                if not route_id:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="routes.txt の行 ", idx=idx),
                        file="routes.txt",
                        row=idx,
                        details={"error": "route_id が必須です。"}
                    ))
                    continue
                
                route_short_name = row.get("route_short_name", "").strip()
                route_long_name = row.get("route_long_name", "").strip()
                if not route_short_name and not route_long_name:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="routes.txt の行 ", idx=idx),
                        file="routes.txt",
                        row=idx,
                        details={"error": "route_short_name と route_long_name の両方が空です。少なくとも一つは必要です。"}
                    ))
                
                # Validate route_type
                route_type_str = row.get("route_type", "").strip()
                if route_type_str:
                    try:
                        route_type = int(route_type_str)
                        if route_type not in (0, 1, 2, 3, 4, 5, 6, 7, 11, 12):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="routes.txt の行 ", idx=idx),
                                file="routes.txt",
                                row=idx,
                                details={"error": f"route_type '{route_type}' が無効です。有効な値: 0, 1, 2, 3, 4, 5, 6, 7, 11, 12"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="routes.txt の行 ", idx=idx),
                            file="routes.txt",
                            row=idx,
                            details={"error": f"route_type '{route_type_str}' は整数である必要があります。"}
                        ))
                    
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="routes.txt の行 ", idx=idx),
                    file="routes.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_shapes_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                shape_id = row.get("shape_id", "").strip()
                if not shape_id:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                        file="shapes.txt",
                        row=idx,
                        details={"error": "shape_id が必須です。"}
                    ))
                    continue
                
                # Validate coordinates
                try:
                    lat_str = row.get("shape_pt_lat", "").strip()
                    lon_str = row.get("shape_pt_lon", "").strip()
                    
                    if not lat_str or not lon_str:
                        error_rows.append(self._err(
                            source="internal",
                            code="missing_field",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                            file="shapes.txt",
                            row=idx,
                            details={"error": "shape_pt_lat と shape_pt_lon が必須です。"}
                        ))
                        continue
                    
                    lat = float(lat_str)
                    lon = float(lon_str)
                    
                    if lat < -90 or lat > 90:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_coordinate",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                            file="shapes.txt",
                            row=idx,
                            details={"error": f"緯度 {lat} は-90から90の範囲である必要があります。"}
                        ))
                    if lon < -180 or lon > 180:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_coordinate",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                            file="shapes.txt",
                            row=idx,
                            details={"error": f"経度 {lon} は-180から180の範囲である必要があります。"}
                        ))
                except (ValueError, TypeError) as e:
                    error_rows.append(self._err(
                        source="internal",
                        code="invalid_coordinate",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                        file="shapes.txt",
                        row=idx,
                        details={"error": f"座標が無効です: {str(e)}"}
                    ))
                
                # Validate sequence
                seq_str = row.get("shape_pt_sequence", "").strip()
                if seq_str:
                    try:
                        seq = int(seq_str)
                        if seq < 0:
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                                file="shapes.txt",
                                row=idx,
                                details={"error": f"shape_pt_sequence '{seq}' は0以上である必要があります。"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                            file="shapes.txt",
                            row=idx,
                            details={"error": f"shape_pt_sequence '{seq_str}' は整数である必要があります。"}
                        ))
                    
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="shapes.txt の行 ", idx=idx),
                    file="shapes.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_trips_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                required = ["trip_id", "route_id", "service_id"]
                missing_fields = []
                for field in required:
                    value = row.get(field, "").strip()
                    if not value:
                        missing_fields.append(field)
                
                if missing_fields:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="trips.txt の行 ", idx=idx),
                        file="trips.txt",
                        row=idx,
                        details={"error": f"{', '.join(missing_fields)} が必須です。"}
                    ))
                
                # Validate direction_id if present
                direction_val = row.get("direction_id", "").strip()
                if direction_val:
                    try:
                        dir_id = int(direction_val)
                        if dir_id not in (-1, 0, 1):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="trips.txt の行 ", idx=idx),
                                file="trips.txt",
                                row=idx,
                                details={"error": f"direction_id '{dir_id}' は -1, 0, 1 のいずれかである必要があります。"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="trips.txt の行 ", idx=idx),
                            file="trips.txt",
                            row=idx,
                            details={"error": f"direction_id '{direction_val}' は整数である必要があります。"}
                        ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="trips.txt の行 ", idx=idx),
                    file="trips.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_stop_times_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                required = ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"]
                missing_fields = []
                for field in required:
                    value = row.get(field, "").strip()
                    if not value:
                        missing_fields.append(field)
                
                if missing_fields:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                        file="stop_times.txt",
                        row=idx,
                        details={"error": f"{', '.join(missing_fields)} が必須です。"}
                    ))
                
                # Validate time format (HH:MM:SS)
                for time_field in ["arrival_time", "departure_time"]:
                    time_val = row.get(time_field, "").strip()
                    if time_val:
                        parts = time_val.split(":")
                        if len(parts) != 3:
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_format",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                                file="stop_times.txt",
                                row=idx,
                                details={"error": f"{time_field} の形式が無効です (HH:MM:SS)。"}
                            ))
                        else:
                            try:
                                h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
                                if m < 0 or m >= 60 or s < 0 or s >= 60:
                                    error_rows.append(self._err(
                                        source="internal",
                                        code="invalid_value",
                                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                                        file="stop_times.txt",
                                        row=idx,
                                        details={"error": f"{time_field} '{time_val}' の値が無効です。"}
                                    ))
                            except (ValueError, TypeError):
                                error_rows.append(self._err(
                                    source="internal",
                                    code="invalid_format",
                                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                                    file="stop_times.txt",
                                    row=idx,
                                    details={"error": f"{time_field} '{time_val}' の形式が無効です。"}
                                ))
                
                # Validate stop_sequence
                seq_str = row.get("stop_sequence", "").strip()
                if seq_str:
                    try:
                        seq = int(seq_str)
                        if seq < 0:
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                                file="stop_times.txt",
                                row=idx,
                                details={"error": f"stop_sequence '{seq}' は0以上である必要があります。"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                            file="stop_times.txt",
                            row=idx,
                            details={"error": f"stop_sequence '{seq_str}' は整数である必要があります。"}
                        ))
                
                # Validate pickup_type and drop_off_type
                for field in ["pickup_type", "drop_off_type"]:
                    val = row.get(field, "").strip()
                    if val:
                        try:
                            t = int(val)
                            if t not in (0, 1, 2, 3):
                                error_rows.append(self._err(
                                    source="internal",
                                    code="invalid_value",
                                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                                    file="stop_times.txt",
                                    row=idx,
                                    details={"error": f"{field} '{t}' は 0-3 の範囲である必要があります。"}
                                ))
                        except (ValueError, TypeError):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                                file="stop_times.txt",
                                row=idx,
                                details={"error": f"{field} '{val}' は整数である必要があります。"}
                            ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="stop_times.txt の行 ", idx=idx),
                    file="stop_times.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_calendar_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                service_id = row.get("service_id", "").strip()
                if not service_id:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar.txt の行 ", idx=idx),
                        file="calendar.txt",
                        row=idx,
                        details={"error": "service_id が必須です。"}
                    ))
                    continue
                
                # Validate day fields (0 or 1)
                days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                for day in days:
                    val = row.get(day, "").strip()
                    if val:
                        try:
                            d = int(val)
                            if d not in (0, 1):
                                error_rows.append(self._err(
                                    source="internal",
                                    code="invalid_value",
                                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar.txt の行 ", idx=idx),
                                    file="calendar.txt",
                                    row=idx,
                                    details={"error": f"{day} '{d}' は 0 または 1 である必要があります。"}
                                ))
                        except (ValueError, TypeError):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar.txt の行 ", idx=idx),
                                file="calendar.txt",
                                row=idx,
                                details={"error": f"{day} '{val}' は整数である必要があります。"}
                            ))
                
                # Validate date format (YYYYMMDD)
                for date_field in ["start_date", "end_date"]:
                    date_val = row.get(date_field, "").strip()
                    if date_val:
                        try:
                            datetime.strptime(date_val, "%Y%m%d")
                        except ValueError:
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_format",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar.txt の行 ", idx=idx),
                                file="calendar.txt",
                                row=idx,
                                details={"error": f"{date_field} '{date_val}' の形式が無効です (YYYYMMDD)。"}
                            ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar.txt の行 ", idx=idx),
                    file="calendar.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_calendar_dates_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                service_id = row.get("service_id", "").strip()
                if not service_id:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar_dates.txt の行 ", idx=idx),
                        file="calendar_dates.txt",
                        row=idx,
                        details={"error": "service_id が必須です。"}
                    ))
                    continue
                
                # Validate date format
                date_val = row.get("date", "").strip()
                if date_val:
                    try:
                        datetime.strptime(date_val, "%Y%m%d")
                    except ValueError:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_format",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar_dates.txt の行 ", idx=idx),
                            file="calendar_dates.txt",
                            row=idx,
                            details={"error": f"date '{date_val}' の形式が無効です (YYYYMMDD)。"}
                        ))
                
                # Validate exception_type
                exc_val = row.get("exception_type", "").strip()
                if exc_val:
                    try:
                        exc = int(exc_val)
                        if exc not in (1, 2):
                            error_rows.append(self._err(
                                source="internal",
                                code="invalid_value",
                                message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar_dates.txt の行 ", idx=idx),
                                file="calendar_dates.txt",
                                row=idx,
                                details={"error": f"exception_type '{exc}' は 1 または 2 である必要があります。"}
                            ))
                    except (ValueError, TypeError):
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_value",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar_dates.txt の行 ", idx=idx),
                            file="calendar_dates.txt",
                            row=idx,
                            details={"error": f"exception_type '{exc_val}' は整数である必要があります。"}
                        ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="calendar_dates.txt の行 ", idx=idx),
                    file="calendar_dates.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_agency_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                required = ["agency_name", "agency_url", "agency_timezone"]
                missing_fields = []
                for field in required:
                    if not row.get(field, "").strip():
                        missing_fields.append(field)
                
                if missing_fields:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="agency.txt の行 ", idx=idx),
                        file="agency.txt",
                        row=idx,
                        details={"error": f"{', '.join(missing_fields)} が必須です。"}
                    ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="agency.txt の行 ", idx=idx),
                    file="agency.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_feed_info_file(self, file):
        decoded_file = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded_file)
        reader.fieldnames = [h.strip() for h in reader.fieldnames]
        error_rows = []
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                required = ["feed_publisher_name", "feed_publisher_url", "feed_lang"]
                missing_fields = []
                for field in required:
                    if not row.get(field, "").strip():
                        missing_fields.append(field)
                
                if missing_fields:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="feed_info.txt の行 ", idx=idx),
                        file="feed_info.txt",
                        row=idx,
                        details={"error": f"{', '.join(missing_fields)} が必須です。"}
                    ))
                
                # Validate dates if present
                start_date_str = row.get("feed_start_date", "").strip()
                end_date_str = row.get("feed_end_date", "").strip()
                
                start_date = None
                end_date = None
                
                if start_date_str:
                    try:
                        start_date = datetime.strptime(start_date_str, "%Y%m%d").date()
                    except ValueError:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_format",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="feed_info.txt の行 ", idx=idx),
                            file="feed_info.txt",
                            row=idx,
                            details={"error": f"feed_start_date '{start_date_str}' の形式が無効です (YYYYMMDD)。"}
                        ))
                
                if end_date_str:
                    try:
                        end_date = datetime.strptime(end_date_str, "%Y%m%d").date()
                    except ValueError:
                        error_rows.append(self._err(
                            source="internal",
                            code="invalid_format",
                            message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="feed_info.txt の行 ", idx=idx),
                            file="feed_info.txt",
                            row=idx,
                            details={"error": f"feed_end_date '{end_date_str}' の形式が無効です (YYYYMMDD)。"}
                        ))
                
                # Validate date range
                if start_date and end_date and start_date > end_date:
                    error_rows.append(self._err(
                        source="internal",
                        code="date_range_invalid",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="feed_info.txt の行 ", idx=idx),
                        file="feed_info.txt",
                        row=idx,
                        details={"error": "feed_start_date が feed_end_date より後になっています。"}
                    ))
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="feed_info.txt の行 ", idx=idx),
                    file="feed_info.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows

    def _validate_translations_file(self, file):
        """
        NOTE: This validation method is NOT called during normal validation flow.
        Translation validation is skipped in GTFSValidator and handled by GTFSImporter
        with warning logic instead (see optional files handling).
        
        This method is kept for reference and potential future use.
        """
        decoded = io.TextIOWrapper(file, encoding='utf-8-sig')
        reader = csv.DictReader(decoded)
        reader.fieldnames = [(h or "").strip() for h in (reader.fieldnames or [])]
        error_rows = []
        
        # Track unique combinations for duplicate detection
        seen_translations = set()
        has_spec_cols = any(h in reader.fieldnames for h in ["record_id", "record_sub_id"])
        
        for idx, row in enumerate(reader, start=1):
            try:
                # Validate required fields
                table_name = (row.get("table_name") or "").strip()
                field_name = (row.get("field_name") or "").strip()
                language = (row.get("language") or "").strip()
                
                missing_fields = []
                if not table_name:
                    missing_fields.append("table_name")
                if not field_name:
                    missing_fields.append("field_name")
                if not language:
                    missing_fields.append("language")
                
                if missing_fields:
                    error_rows.append(self._err(
                        source="internal",
                        code="missing_field",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="translations.txt の行 ", idx=idx),
                        file="translations.txt",
                        row=idx,
                        details={"error": f"{', '.join(missing_fields)} が必須です。"}
                    ))
                    continue
                
                # Get field_value
                field_value = (row.get("field_value") or row.get("record_value") or "").strip()
                
                # Determine record_id and record_sub_id
                record_id = record_sub_id = ""
                
                if has_spec_cols:
                    # GTFS-spec format
                    record_id = (row.get("record_id") or "").strip()
                    record_sub_id = (row.get("record_sub_id") or "").strip()
                else:
                    # Custom format - map to record_id based on table_name
                    t = table_name.lower()
                    if t == "routes":
                        record_id = (row.get("route_id") or "").strip()
                    elif t == "trips":
                        record_id = (row.get("trip_id") or "").strip()
                    elif t == "stops":
                        record_id = (row.get("stop_id") or "").strip()
                    elif t == "stop_times":
                        record_id = (row.get("trip_id") or "").strip()
                        record_sub_id = (row.get("stop_id") or "").strip()
                    elif t == "shapes":
                        record_id = (row.get("shape_id") or "").strip()
                    elif t == "calendar" or t == "calendar_dates":
                        record_id = (row.get("service_id") or "").strip()
                    elif t == "feed_info":
                        record_id = (row.get("feed_info_id") or "").strip()
                
                # Check for duplicates
                # Per GTFS spec: UNIQUE (table_name, field_name, language, record_id, record_sub_id, field_value)
                translation_key = (
                    table_name,
                    field_name,
                    language,
                    record_id,
                    record_sub_id,
                    field_value
                )
                
                if translation_key in seen_translations:
                    error_rows.append(self._err(
                        source="internal",
                        code="duplicate_entry",
                        message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="translations.txt の行 ", idx=idx),
                        file="translations.txt",
                        row=idx,
                        details={
                            "error": f"重複した翻訳エントリ - table_name='{table_name}', "
                                   f"field_name='{field_name}', language='{language}', "
                                   f"record_id='{record_id}', record_sub_id='{record_sub_id}', "
                                   f"field_value='{field_value}'"
                        }
                    ))
                else:
                    seen_translations.add(translation_key)
                        
            except Exception as e:
                error_rows.append(self._err(
                    source="internal",
                    code="parse_error",
                    message=ErrorMessages.GTFS_FILE_ROW_ERROR_TEMPLATE_JA.format(filename="translations.txt の行 ", idx=idx),
                    file="translations.txt",
                    row=idx,
                    details={"error": str(e)}
                ))

        return error_rows


@log_service_call
class ScenarioValidatorService:
    @staticmethod
    def validate_local(*, user, scenario_name: str, gtfs_zip) -> dict[str, Any]:
        """
        Validation for local upload (same as ScenarioLocalViewSet.create)
        
        Request body:
        - scenario_name: string (required)
        - gtfs_zip: file (required, .zip)
        """
        if not gtfs_zip or not getattr(gtfs_zip, "name", "").lower().endswith(".zip"):
            return {
                "data": None,
                "message": "ファイル形式が無効です。ZIPファイルのみアップロードできます。",
                "error": {
                    "source": "internal",
                    "code": "invalid_file_format",
                    "message": "ファイル形式が無効です。ZIPファイルのみアップロードできます。",
                },
                "status_code": 400,
            }

        if Scenario.objects.filter(
            scenario_name=scenario_name, 
            user=user,
            deletion_state=ScenarioDeletionState.ACTIVE.value
        ).exists():
            return {
                "data": None,
                "message": "シナリオ名が既に存在します。",
                "error": {"source": "internal", "code": "duplicate_scenario_name", "message": "シナリオ名が既に存在します。"},
                "status_code": 400,
            }

        try:
            if hasattr(gtfs_zip, "seek"):
                gtfs_zip.seek(0)
            validator = GTFSValidator()
            validation_errors = validator.validate(gtfs_zip, scenario_name)
        except Exception as e:
            logger.exception("GTFS validation failed unexpectedly")
            return {
                "data": None,
                "message": ErrorMessages.VALIDATION_PROCESSING_ERROR_JA,
                "error": {"source": "internal", "code": "validation_exception", "message": str(e)},
                "status_code": 500,
            }

        if validation_errors:
            return {
                "data": None,
                "message": f"GTFSファイルにエラーがあります。{len(validation_errors)}件のエラーが見つかりました。",
                "error": validation_errors,
                "status_code": 400,
            }

        return {
            "message": "バリデーションが成功しました。アップロード可能です。",
            "data": {
                "scenario_name": scenario_name,
                "filename": gtfs_zip.name,
                "validation_status": "valid"
            },
            "error": None,
            "status_code": 200,
        }

    @staticmethod
    def validate_api(
        *,
        user,
        organization_id: str,
        feed_id: str,
        scenario_name: str,
        gtfs_file_uid: str,
        start_date=None,
        end_date=None,
    ) -> dict[str, Any]:
        """
        Validation for download from API (same as ScenarioAPIViewSet.create)
        
        Request body:
        - organization_id: string (required)
        - feed_id: string (required)
        - scenario_name: string (required)
        - gtfs_file_uid: string (required)
        - start_date: date (optional)
        - end_date: date (optional)
        """
        if end_date and start_date and start_date > end_date:
            return {
                "data": None,
                "message": "開始日が終了日より後になっています。",
                "error": {"source": "internal", "code": "date_range_invalid", "message": "開始日が終了日より後になっています。"},
                "status_code": 400,
            }

        if Scenario.objects.filter(
            scenario_name=scenario_name,
            user=user,
            deletion_state=ScenarioDeletionState.ACTIVE.value
        ).exists():
            return {
                "data": None,
                "message": "シナリオ名が既に存在します。",
                "error": {"source": "internal", "code": "duplicate_scenario_name", "message": "シナリオ名が既に存在します。"},
                "status_code": 400,
            }

        try:
            response = requests.get(
                f"https://api.gtfs-data.jp/v2/organizations/{organization_id}/feeds/{feed_id}/files/feed.zip?uid={gtfs_file_uid}",
                timeout=60
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            return {
                "data": None,
                "message": "GTFSデータの取得中にエラーが発生しました。",
                "error": {"source": "external", "code": "api_fetch_error", "message": str(e)},
                "status_code": 400,
            }

        gtfs_zip = ContentFile(response.content, name=f"{feed_id}.zip")

        try:
            if hasattr(gtfs_zip, "seek"):
                gtfs_zip.seek(0)
            validator = GTFSValidator()
            validation_errors = validator.validate(gtfs_zip, scenario_name)
        except Exception as e:
            logger.exception("GTFS validation failed unexpectedly")
            return {
                "data": None,
                "message": ErrorMessages.VALIDATION_PROCESSING_ERROR_JA,
                "error": {"source": "internal", "code": "validation_exception", "message": str(e)},
                "status_code": 500,
            }

        if validation_errors:
            return {
                "data": None,
                "message": f"GTFSファイルにエラーがあります。{len(validation_errors)}件のエラーが見つかりました。",
                "error": validation_errors,
                "status_code": 400,
            }

        return {
            "message": "バリデーションが成功しました。インポート可能です。",
            "data": {
                "scenario_name": scenario_name,
                "organization_id": organization_id,
                "feed_id": feed_id,
                "start_date": start_date,
                "end_date": end_date,
                "validation_status": "valid"
            },
            "error": None,
            "status_code": 200,
        }
