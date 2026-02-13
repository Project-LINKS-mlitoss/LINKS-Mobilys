# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""GTFS app configuration constants.

All configuration values, thresholds, and limits should be defined here
to avoid magic numbers throughout the codebase.
"""

# =============================================================================
# Field Length Limits
# =============================================================================

# Model field max lengths
MAX_SCENARIO_NAME_LENGTH = 200
MAX_FILENAME_LENGTH = 255
MAX_STOP_NAME_LENGTH = 200
MAX_ROUTE_NAME_LENGTH = 200
MAX_AGENCY_NAME_LENGTH = 200
MAX_URL_LENGTH = 200
MAX_TIMEZONE_LENGTH = 50
MAX_LANG_CODE_LENGTH = 10
MAX_PHONE_LENGTH = 20
MAX_EMAIL_LENGTH = 200

# Coordinate precision
MAX_COORDINATE_PRECISION = 6  # Decimal places for lat/lon (9 total digits)

# =============================================================================
# Coordinate Validation Limits
# =============================================================================

MIN_LATITUDE = -90.0
MAX_LATITUDE = 90.0
MIN_LONGITUDE = -180.0
MAX_LONGITUDE = 180.0

# =============================================================================
# Processing Limits
# =============================================================================

# Batch processing
BATCH_SIZE = 1000
MAX_IMPORT_ROWS = 1_000_000

# Timeout settings
PROCESSING_TIMEOUT_SECONDS = 3600  # 1 hour
GRAPH_BUILD_TIMEOUT_SECONDS = 7200  # 2 hours

# File upload limits
MAX_UPLOAD_SIZE_MB = 500
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = ['.zip', '.csv', '.txt', '.xlsx']

# =============================================================================
# Cache Settings
# =============================================================================

CACHE_TTL_SHORT = 300       # 5 minutes
CACHE_TTL_MEDIUM = 1800     # 30 minutes
CACHE_TTL_LONG = 3600       # 1 hour
CACHE_TTL_DAY = 86400       # 24 hours

# =============================================================================
# External Services
# =============================================================================

GTFS_VALIDATOR_URL = "http://validator:8003/validate"
GTFS_VALIDATOR_TIMEOUT_SECONDS = 120

# =============================================================================
# API Settings
# =============================================================================

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 1000

# =============================================================================
# Validation Thresholds
# =============================================================================

class ValidationThresholds:
    """Threshold values for GTFS data validation."""

    # Field length validation
    MAX_STOP_NAME_LENGTH = MAX_STOP_NAME_LENGTH
    MAX_ROUTE_NAME_LENGTH = MAX_ROUTE_NAME_LENGTH
    MAX_AGENCY_NAME_LENGTH = MAX_AGENCY_NAME_LENGTH

    # Coordinate validation
    MAX_COORDINATE_PRECISION = MAX_COORDINATE_PRECISION
    MIN_LATITUDE = MIN_LATITUDE
    MAX_LATITUDE = MAX_LATITUDE
    MIN_LONGITUDE = MIN_LONGITUDE
    MAX_LONGITUDE = MAX_LONGITUDE

    # Time validation
    MAX_HOUR_VALUE = 47  # GTFS allows times > 24:00 for next-day service
    MAX_MINUTE_VALUE = 59
    MAX_SECOND_VALUE = 59

    # Service date validation
    MIN_SERVICE_DATE_YEAR = 1900
    MAX_SERVICE_DATE_YEAR = 2100

    # Frequency validation
    MIN_HEADWAY_SECONDS = 60  # Minimum 1 minute headway
    MAX_HEADWAY_SECONDS = 86400  # Maximum 24 hours headway

    # Ridership validation
    MIN_RIDERSHIP_VALUE = 0
    MAX_RIDERSHIP_VALUE = 1_000_000  # Per trip/stop


# =============================================================================
# Error Codes
# =============================================================================

class ErrorCodes:
    """Centralized error codes for API responses and validation."""

    # General errors
    VALIDATION_ERROR = 'VALIDATION_ERROR'
    NOT_FOUND = 'NOT_FOUND'
    PERMISSION_DENIED = 'PERMISSION_DENIED'
    INTERNAL_ERROR = 'INTERNAL_ERROR'

    # Scenario errors
    SCENARIO_NOT_FOUND = 'SCENARIO_NOT_FOUND'
    SCENARIO_LOCKED = 'SCENARIO_LOCKED'
    SCENARIO_PROCESSING = 'SCENARIO_PROCESSING'
    SCENARIO_DELETION_PENDING = 'SCENARIO_DELETION_PENDING'
    SCENARIO_NAME_DUPLICATE = 'SCENARIO_NAME_DUPLICATE'

    # Import errors
    IMPORT_FAILED = 'IMPORT_FAILED'
    IMPORT_VALIDATION_FAILED = 'IMPORT_VALIDATION_FAILED'
    INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT'
    FILE_TOO_LARGE = 'FILE_TOO_LARGE'
    FILE_EMPTY = 'FILE_EMPTY'
    MISSING_REQUIRED_FILE = 'MISSING_REQUIRED_FILE'
    CORRUPTED_ZIP_FILE = 'CORRUPTED_ZIP_FILE'

    # Export errors
    EXPORT_FAILED = 'EXPORT_FAILED'
    INCOMPLETE_DATA = 'INCOMPLETE_DATA'
    EXPORT_TIMEOUT = 'EXPORT_TIMEOUT'

    # GTFS validation errors
    GTFS_INVALID_COORDINATE = 'GTFS_INVALID_COORDINATE'
    GTFS_INVALID_TIME = 'GTFS_INVALID_TIME'
    GTFS_INVALID_DATE = 'GTFS_INVALID_DATE'
    GTFS_MISSING_REQUIRED_FIELD = 'GTFS_MISSING_REQUIRED_FIELD'
    GTFS_INVALID_REFERENCE = 'GTFS_INVALID_REFERENCE'
    GTFS_DUPLICATE_KEY = 'GTFS_DUPLICATE_KEY'

    # Graph build errors
    GRAPH_BUILD_FAILED = 'GRAPH_BUILD_FAILED'
    GRAPH_BUILD_TIMEOUT = 'GRAPH_BUILD_TIMEOUT'
    GRAPH_NOT_READY = 'GRAPH_NOT_READY'

    # Ridership errors
    RIDERSHIP_UPLOAD_FAILED = 'RIDERSHIP_UPLOAD_FAILED'
    RIDERSHIP_INVALID_FORMAT = 'RIDERSHIP_INVALID_FORMAT'
    RIDERSHIP_TRIP_NOT_FOUND = 'RIDERSHIP_TRIP_NOT_FOUND'
    RIDERSHIP_DUPLICATE_RECORD = 'RIDERSHIP_DUPLICATE_RECORD'


# =============================================================================
# GTFS File Names
# =============================================================================

class GtfsFileNames:
    """Standard GTFS file names."""

    # Required files
    AGENCY = 'agency.txt'
    STOPS = 'stops.txt'
    ROUTES = 'routes.txt'
    TRIPS = 'trips.txt'
    STOP_TIMES = 'stop_times.txt'

    # Conditionally required files
    CALENDAR = 'calendar.txt'
    CALENDAR_DATES = 'calendar_dates.txt'

    # Optional files
    FARE_ATTRIBUTES = 'fare_attributes.txt'
    FARE_RULES = 'fare_rules.txt'
    SHAPES = 'shapes.txt'
    FREQUENCIES = 'frequencies.txt'
    TRANSFERS = 'transfers.txt'
    PATHWAYS = 'pathways.txt'
    LEVELS = 'levels.txt'
    FEED_INFO = 'feed_info.txt'
    TRANSLATIONS = 'translations.txt'
    ATTRIBUTIONS = 'attributions.txt'

    # Fare v2 files
    FARE_MEDIA = 'fare_media.txt'
    FARE_PRODUCTS = 'fare_products.txt'
    FARE_LEG_RULES = 'fare_leg_rules.txt'
    FARE_TRANSFER_RULES = 'fare_transfer_rules.txt'

    # GTFS-JP specific files
    OFFICE_JP = 'office_jp.txt'
    AGENCY_JP = 'agency_jp.txt'

    @classmethod
    def required_files(cls):
        """Return list of required GTFS files."""
        return [
            cls.AGENCY,
            cls.STOPS,
            cls.ROUTES,
            cls.TRIPS,
            cls.STOP_TIMES,
        ]

    @classmethod
    def all_files(cls):
        """Return list of all known GTFS files."""
        return [
            cls.AGENCY,
            cls.STOPS,
            cls.ROUTES,
            cls.TRIPS,
            cls.STOP_TIMES,
            cls.CALENDAR,
            cls.CALENDAR_DATES,
            cls.FARE_ATTRIBUTES,
            cls.FARE_RULES,
            cls.SHAPES,
            cls.FREQUENCIES,
            cls.TRANSFERS,
            cls.PATHWAYS,
            cls.LEVELS,
            cls.FEED_INFO,
            cls.TRANSLATIONS,
            cls.ATTRIBUTIONS,
            cls.FARE_MEDIA,
            cls.FARE_PRODUCTS,
            cls.FARE_LEG_RULES,
            cls.FARE_TRANSFER_RULES,
            cls.OFFICE_JP,
            cls.AGENCY_JP,
        ]


# =============================================================================
# Export Constants
# =============================================================================

# Default GTFS export file keys (logical keys used in ScenarioService export)
ALL_EXPORT_FILES = [
    'agency',
    'agency_jp',
    'office_jp',
    'pattern_jp',
    'stops',
    'routes',
    'trips',
    'stop_times',
    'calendar',
    'calendar_dates',
    'shapes',
    'frequencies',
    'transfers',
    'pathways',
    'levels',
    'location_groups',
    'location_group_stops',
    'booking_rules',
    'attributions',
    'fare_attributes',
    'fare_rules',
    'feed_info',
    'translations',
    'timeframes',
    'rider_categories',
    'fare_media',
    'fare_products',
    'fare_leg_rules',
    'fare_leg_join_rules',
    'fare_transfer_rules',
    'areas',
    'stop_areas',
    'networks',
    'route_networks',
]


# Ridership export columns (field_name, display_name)
RIDERSHIP_EXPORT_COLUMNS = [
    ("ridership_record_id", "ridership_record_id"),
    ("ic_card_agency_identification_code", "ic_card_agency_identification_code"),
    ("ic_card_issuer_code", "ic_card_issuer_code"),
    ("ic_card_issuer_name", "ic_card_issuer_name"),
    ("ic_card_feature_type", "ic_card_feature_type"),
    ("ticket_type_area_code", "ticket_type_area_code"),
    ("ticket_type", "ticket_type"),
    ("ticket_type_name", "ticket_type_name"),
    ("transportation_mode_code", "transportation_mode_code"),
    ("ic_card_usage_detail_id", "ic_card_usage_detail_id"),
    ("operating_agency_code", "operating_agency_code"),
    ("operating_agency_name", "operating_agency_name"),
    ("serviced_office_code", "serviced_office_code"),
    ("serviced_office_name", "serviced_office_name"),
    ("route_pattern_id", "route_pattern_id"),
    ("route_pattern_number", "route_pattern_number"),
    ("service_line_name", "service_line_name"),
    ("route_id", "route_id"),
    ("route_name", "route_name"),
    ("trip_code", "trip_code"),
    ("timetable_number", "timetable_number"),
    ("vehicle_number", "vehicle_number"),
    ("operation_type", "operation_type"),
    ("operation_detail_type", "operation_detail_type"),
    ("boarding_area_code", "boarding_area_code"),
    ("boarding_station_code", "boarding_station_code"),
    ("boarding_station_name", "boarding_station_name"),
    ("boarding_at", "boarding_at"),
    ("transfer_area_code_list", "transfer_area_code_list"),
    ("transfer_station_code_list", "transfer_station_code_list"),
    ("boarding_station_sequence", "boarding_station_sequence"),
    ("alighting_area_code", "alighting_area_code"),
    ("alighting_station_code", "alighting_station_code"),
    ("alighting_station_name", "alighting_station_name"),
    ("alighting_at", "alighting_at"),
    ("payment_at", "payment_at"),
    ("alighting_station_sequence", "alighting_station_sequence"),
    ("adult_passenger_count", "adult_passenger_count"),
    ("child_passenger_count", "child_passenger_count"),
    ("adult_challenged_passenger_count", "adult_challenged_passenger_count"),
    ("child_challenged_passenger_count", "child_challenged_passenger_count"),
    ("ticket_valid_start_date", "ticket_valid_start_date"),
    ("ticket_valid_end_date", "ticket_valid_end_date"),
    ("passenger_classification_type", "passenger_classification_type"),
]
