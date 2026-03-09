# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""GTFS app constants - centralized enums and configuration values."""

from gtfs.constants.errors import ErrorMessages
from gtfs.constants.enums import (
    # Scenario Enums
    SourceType,
    StopsGroupingMethod,
    GraphStatus,
    ScenarioDeletionState,
    ScenarioEditState,
    # GTFS Specification Enums
    RouteType,
    LocationType,
    WheelchairAccessible,
    BikesAllowed,
    CarsAllowed,
    PickupDropOffType,
    DirectionType,
    TimepointType,
    # Import/Validation Enums
    ValidationSeverity,
    # Ridership Enums
    RidershipUploadStatus,
    RidershipErrorType,
    ICCardFeatureType,
    TicketType,
    OperationType,
    OperationDetailType,
    PassengerClassificationType,
    IsDefaultFareCategory,
)
from gtfs.constants.config import (
    # Field Length Limits
    MAX_SCENARIO_NAME_LENGTH,
    MAX_FILENAME_LENGTH,
    MAX_STOP_NAME_LENGTH,
    MAX_ROUTE_NAME_LENGTH,
    MAX_AGENCY_NAME_LENGTH,
    MAX_URL_LENGTH,
    MAX_COORDINATE_PRECISION,
    # Coordinate Limits
    MIN_LATITUDE,
    MAX_LATITUDE,
    MIN_LONGITUDE,
    MAX_LONGITUDE,
    # Processing Limits
    BATCH_SIZE,
    MAX_IMPORT_ROWS,
    PROCESSING_TIMEOUT_SECONDS,
    # Cache Settings
    CACHE_TTL_SHORT,
    CACHE_TTL_MEDIUM,
    CACHE_TTL_LONG,
    CACHE_TTL_DAY,
    ErrorCodes,
    ALL_EXPORT_FILES,
    RIDERSHIP_EXPORT_COLUMNS,
)

__all__ = [
    'ErrorMessages',
    # Scenario Enums
    'SourceType',
    'StopsGroupingMethod',
    'GraphStatus',
    'ScenarioDeletionState',
    'ScenarioEditState',
    # GTFS Specification Enums
    'RouteType',
    'LocationType',
    'WheelchairAccessible',
    'BikesAllowed',
    'CarsAllowed',
    'PickupDropOffType',
    'DirectionType',
    'TimepointType',
    # Import/Validation Enums
    'ValidationSeverity',
    # Ridership Enums
    'RidershipUploadStatus',
    'RidershipErrorType',
    'ICCardFeatureType',
    'TicketType',
    'OperationType',
    'OperationDetailType',
    'PassengerClassificationType',
    'IsDefaultFareCategory',
    # Config Constants
    'MAX_SCENARIO_NAME_LENGTH',
    'MAX_FILENAME_LENGTH',
    'MAX_STOP_NAME_LENGTH',
    'MAX_ROUTE_NAME_LENGTH',
    'MAX_AGENCY_NAME_LENGTH',
    'MAX_URL_LENGTH',
    'MAX_COORDINATE_PRECISION',
    'MIN_LATITUDE',
    'MAX_LATITUDE',
    'MIN_LONGITUDE',
    'MAX_LONGITUDE',
    'BATCH_SIZE',
    'MAX_IMPORT_ROWS',
    'PROCESSING_TIMEOUT_SECONDS',
    'CACHE_TTL_SHORT',
    'CACHE_TTL_MEDIUM',
    'CACHE_TTL_LONG',
    'CACHE_TTL_DAY',
    'ErrorCodes',
    'ALL_EXPORT_FILES',
    'RIDERSHIP_EXPORT_COLUMNS',
]
