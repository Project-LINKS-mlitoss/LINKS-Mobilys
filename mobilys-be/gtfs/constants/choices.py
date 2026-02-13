# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""Django model choices.

This module provides direct access to choices tuples for Django model fields.
All choices are derived from the enums defined in enums.py.

Usage in models:
    from gtfs.constants.choices import ROUTE_TYPE_CHOICES

    class Route(models.Model):
        route_type = models.IntegerField(choices=ROUTE_TYPE_CHOICES)
"""

from gtfs.constants.enums import (
    SourceType,
    StopsGroupingMethod,
    GraphStatus,
    ScenarioDeletionState,
    ScenarioEditState,
    RouteType,
    LocationType,
    WheelchairAccessible,
    BikesAllowed,
    CarsAllowed,
    PickupDropOffType,
    DirectionType,
    TimepointType,
    ValidationSeverity,
    RidershipUploadStatus,
    RidershipErrorType,
)

# =============================================================================
# Scenario Choices
# =============================================================================

SOURCE_TYPE_CHOICES = SourceType.choices()
STOPS_GROUPING_METHOD_CHOICES = StopsGroupingMethod.choices()
GRAPH_STATUS_CHOICES = GraphStatus.choices()
SCENARIO_DELETION_STATE_CHOICES = ScenarioDeletionState.choices()
SCENARIO_EDIT_STATE_CHOICES = ScenarioEditState.choices()

# =============================================================================
# GTFS Specification Choices
# =============================================================================

ROUTE_TYPE_CHOICES = RouteType.choices()
LOCATION_TYPE_CHOICES = LocationType.choices()
WHEELCHAIR_ACCESSIBLE_CHOICES = WheelchairAccessible.choices()
BIKES_ALLOWED_CHOICES = BikesAllowed.choices()
CARS_ALLOWED_CHOICES = CarsAllowed.choices()
PICKUP_DROPOFF_TYPE_CHOICES = PickupDropOffType.choices()
DIRECTION_TYPE_CHOICES = DirectionType.choices()
TIMEPOINT_TYPE_CHOICES = TimepointType.choices()

# =============================================================================
# Import & Validation Choices
# =============================================================================

VALIDATION_SEVERITY_CHOICES = ValidationSeverity.choices()

# =============================================================================
# Ridership Choices
# =============================================================================

RIDERSHIP_UPLOAD_STATUS_CHOICES = RidershipUploadStatus.choices()
RIDERSHIP_ERROR_TYPE_CHOICES = RidershipErrorType.choices()
