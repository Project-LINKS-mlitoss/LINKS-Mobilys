# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Backward-compatible facade for ridership change service logic.

Keep imports stable for existing call sites while implementations live in
`simulation.services.ridership_change.*`.
"""

from simulation.services.ridership_change.baselines import (
    compute_delta_riders,
    get_baseline_riders_from_icagg,
    get_baseline_riders_per_day_from_iccard,
    get_baseline_trips_per_day_from_gtfs,
)
from simulation.services.ridership_change.seed import _seed_ridership_changes
from simulation.services.ridership_change.service import RidershipChangeService

__all__ = [
    "RidershipChangeService",
    "_seed_ridership_changes",
    "get_baseline_riders_from_icagg",
    "get_baseline_trips_per_day_from_gtfs",
    "get_baseline_riders_per_day_from_iccard",
    "compute_delta_riders",
]

