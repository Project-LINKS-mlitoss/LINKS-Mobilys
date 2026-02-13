# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""GTFS app enum definitions.

All enums follow the pattern:
- Inherit from StrEnum or IntEnumBase for proper JSON serialization
- Provide choices() method for Django model fields
- Use descriptive names that match GTFS specification where applicable
"""

from enum import Enum, IntEnum


class StrEnum(str, Enum):
    """Base class for string enums that serialize to JSON properly."""

    def __str__(self) -> str:
        return self.value

    @classmethod
    def choices(cls):
        """Return choices tuple for Django model fields."""
        return [(item.value, item.name.replace('_', ' ').title()) for item in cls]

    @classmethod
    def values(cls):
        """Return list of all values."""
        return [item.value for item in cls]


class IntEnumBase(IntEnum):
    """Base class for integer enums."""

    @classmethod
    def choices(cls):
        """Return choices tuple for Django model fields."""
        return [(item.value, item.name.replace('_', ' ').title()) for item in cls]

    @classmethod
    def values(cls):
        """Return list of all values."""
        return [item.value for item in cls]


# =============================================================================
# Scenario Related Enums
# =============================================================================

class SourceType(IntEnumBase):
    """Source type for GTFS scenario data."""
    API = 0
    LOCAL_FILE = 1
    CLONED_FILE = 2

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.API.value, "API"),
            (cls.LOCAL_FILE.value, "Local File"),
            (cls.CLONED_FILE.value, "Cloned File"),
        ]


class StopsGroupingMethod(StrEnum):
    """Method to group stops in scenario."""
    STOP_NAME = 'stop_name'
    STOP_ID = 'stop_id'


class GraphStatus(StrEnum):
    """Graph build status for OSM and DRM graphs."""
    PENDING = 'pending'
    BUILDING = 'building'
    BUILT = 'built'
    FAILED = 'failed'
    REBUILDING = 'rebuilding'
    REBUILT = 'rebuilt'
    REBUILD_FAILED = 'rebuild_failed'

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.PENDING.value, 'Pending'),
            (cls.BUILDING.value, 'Building'),
            (cls.BUILT.value, 'Built'),
            (cls.FAILED.value, 'Failed'),
            (cls.REBUILDING.value, 'Rebuilding'),
            (cls.REBUILT.value, 'Rebuilt'),
            (cls.REBUILD_FAILED.value, 'Rebuild Failed'),
        ]


class ScenarioDeletionState(StrEnum):
    """Scenario deletion state."""
    ACTIVE = 'active'
    DELETION_PENDING = 'deletion_pending'
    FAILED = 'failed'


class ScenarioEditState(StrEnum):
    """Scenario edit state tracking."""
    ORIGINAL = 'original'
    EDITED = 'edited'


# =============================================================================
# GTFS Specification Enums
# Based on official GTFS specification: https://gtfs.org/reference/static
# =============================================================================

class RouteType(IntEnumBase):
    """GTFS route_type values.

    Reference: https://gtfs.org/reference/static#routestxt
    """
    TRAM = 0  # Tram, Streetcar, Light rail
    SUBWAY = 1  # Subway, Metro
    RAIL = 2  # Rail (e.g., commuter rail)
    BUS = 3  # Bus
    FERRY = 4  # Ferry
    CABLE_TRAM = 5  # Cable car
    AERIAL_LIFT = 6  # Gondola, Suspended cable car
    FUNICULAR = 7  # Funicular
    TROLLEYBUS = 11  # Trolleybus
    MONORAIL = 12  # Monorail

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.TRAM.value, "Tram, Streetcar, Light rail"),
            (cls.SUBWAY.value, "Subway, Metro"),
            (cls.RAIL.value, "Rail (e.g., commuter rail)"),
            (cls.BUS.value, "Bus"),
            (cls.FERRY.value, "Ferry"),
            (cls.CABLE_TRAM.value, "Cable car"),
            (cls.AERIAL_LIFT.value, "Gondola, Suspended cable car"),
            (cls.FUNICULAR.value, "Funicular"),
            (cls.TROLLEYBUS.value, "Trolleybus"),
            (cls.MONORAIL.value, "Monorail"),
        ]


class LocationType(IntEnumBase):
    """GTFS location_type for stops.

    Reference: https://gtfs.org/reference/static#stopstxt
    """
    STOP = 0  # Stop or platform
    STATION = 1  # Station
    ENTRANCE_EXIT = 2  # Entrance/Exit
    GENERIC_NODE = 3  # Generic node
    BOARDING_AREA = 4  # Boarding area


class WheelchairAccessible(IntEnumBase):
    """GTFS wheelchair accessibility values.

    Reference: https://gtfs.org/reference/static#stopstxt
    """
    NO_INFO = 0  # No accessibility information
    ACCESSIBLE = 1  # Wheelchair accessible
    NOT_ACCESSIBLE = 2  # Not wheelchair accessible


class BikesAllowed(IntEnumBase):
    """GTFS bikes_allowed values.

    Reference: https://gtfs.org/reference/static#tripstxt
    """
    NO_INFO = 0  # No bike information
    ALLOWED = 1  # Bikes allowed
    NOT_ALLOWED = 2  # Bikes not allowed


class CarsAllowed(IntEnumBase):
    """GTFS cars_allowed values (JP extension).

    Reference: GTFS-JP specification
    """
    NO_INFO = 0  # No car information
    ALLOWED = 1  # Cars allowed
    NOT_ALLOWED = 2  # Cars not allowed


class PickupDropOffType(IntEnumBase):
    """GTFS pickup_type and drop_off_type values.

    Reference: https://gtfs.org/reference/static#stop_timestxt
    """
    REGULAR = 0  # Regularly scheduled pickup/drop-off
    NOT_AVAILABLE = 1  # No pickup/drop-off available
    PHONE_AGENCY = 2  # Must phone agency to arrange
    COORDINATE_WITH_DRIVER = 3  # Must coordinate with driver


class DirectionType(IntEnumBase):
    """GTFS direction_id values.

    Reference: https://gtfs.org/reference/static#tripstxt
    """
    OUTBOUND = 0  # Travel in one direction (e.g., outbound travel)
    INBOUND = 1  # Travel in opposite direction (e.g., inbound travel)

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.OUTBOUND.value, "Outbound"),
            (cls.INBOUND.value, "Inbound"),
        ]


class TimepointType(IntEnumBase):
    """GTFS timepoint values.

    Reference: https://gtfs.org/reference/static#stop_timestxt
    """
    APPROXIMATE = 0  # Times are considered approximate
    EXACT = 1  # Times are considered exact

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.APPROXIMATE.value, "Approximate time"),
            (cls.EXACT.value, "Exact time"),
        ]


# =============================================================================
# Import & Validation Enums
# =============================================================================

class ValidationSeverity(StrEnum):
    """GTFS validation notice severity levels."""
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


# =============================================================================
# Ridership Data Enums
# =============================================================================

class RidershipUploadStatus(StrEnum):
    """Status of ridership data upload processing."""
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    PARTIAL = 'partial'

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.PENDING.value, 'Pending'),
            (cls.PROCESSING.value, 'Processing'),
            (cls.COMPLETED.value, 'Completed'),
            (cls.FAILED.value, 'Failed'),
            (cls.PARTIAL.value, 'Partial Success'),
        ]


class RidershipErrorType(StrEnum):
    """Types of errors during ridership data upload."""
    VALIDATION = 'validation'
    PARSING = 'parsing'
    DUPLICATE = 'duplicate'
    MISSING_REQUIRED = 'missing_required'
    INVALID_FORMAT = 'invalid_format'
    INVALID_VALUE = 'invalid_value'
    REFERENCE = 'reference'
    TRIP_NOT_FOUND = 'trip_not_found'
    UNKNOWN = 'unknown'

    @classmethod
    def choices(cls):
        """Return human-readable choices."""
        return [
            (cls.VALIDATION.value, 'Validation Error'),
            (cls.PARSING.value, 'Parsing Error'),
            (cls.DUPLICATE.value, 'Duplicate Record'),
            (cls.MISSING_REQUIRED.value, 'Missing Required Field'),
            (cls.INVALID_FORMAT.value, 'Invalid Format'),
            (cls.INVALID_VALUE.value, 'Invalid Value'),
            (cls.REFERENCE.value, 'Reference Error'),
            (cls.TRIP_NOT_FOUND.value, 'Trip Not Found'),
            (cls.UNKNOWN.value, 'Unknown Error'),
        ]


class ICCardFeatureType(StrEnum):
    """IC card feature types for ridership records."""

    SF_CREDIT_AUTOCHARGE = "SF_CREDIT_AUTOCHARGE"
    SF_ONLY = "SF_ONLY"
    SF_NO_CREDIT = "SF_NO_CREDIT"

    @classmethod
    def choices(cls):
        """Preserve legacy (value, value) display."""
        return [(item.value, item.value) for item in cls]


class TicketType(StrEnum):
    """Ticket types for ridership records."""

    SINGLE_TRIP_TICKET = "SINGLE_TRIP_TICKET"
    STUDENT_PASS = "STUDENT_PASS"
    COMMUTER_PASS = "COMMUTER_PASS"
    EXCURSION_TICKET = "EXCURSION_TICKET"
    ONE_DAY_PASS = "ONE_DAY_PASS"
    SHORT_TERM_PASS = "SHORT_TERM_PASS"

    @classmethod
    def choices(cls):
        """Preserve legacy (value, value) display."""
        return [(item.value, item.value) for item in cls]


class OperationType(StrEnum):
    """Entry/exit types for ridership records."""

    ENTRY = "ENTRY"
    EXIT = "EXIT"

    @classmethod
    def choices(cls):
        """Preserve legacy (value, value) display."""
        return [(item.value, item.value) for item in cls]


class OperationDetailType(StrEnum):
    """Operation detail types for ridership records."""

    DISCOUNT_TRANSFER = "DISCOUNT_TRANSFER"
    SPECIFIC_FARE = "SPECIFIC_FARE"
    ADDITIONAL_FARE = "ADDITIONAL_FARE"

    @classmethod
    def choices(cls):
        """Preserve legacy (value, value) display."""
        return [(item.value, item.value) for item in cls]


class PassengerClassificationType(StrEnum):
    """Passenger classification types for ridership records."""

    ADULT = "ADULT"
    CHILD = "CHILD"
    INFANT = "INFANT"
    SENIOR = "SENIOR"
    DISABLED = "DISABLED"

    @classmethod
    def choices(cls):
        """Preserve legacy (value, value) display."""
        return [(item.value, item.value) for item in cls]


class IsDefaultFareCategory(IntEnumBase):
    """Flag for whether a fare category is default (fares extension)."""

    NOT_DEFAULT = 0
    DEFAULT = 1

    @classmethod
    def choices(cls):
        """Preserve legacy display labels."""
        return [
            (cls.NOT_DEFAULT.value, "Not default"),
            (cls.DEFAULT.value, "Default"),
        ]
