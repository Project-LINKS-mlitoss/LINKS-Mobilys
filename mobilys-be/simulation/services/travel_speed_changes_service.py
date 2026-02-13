# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Backward-compatible facade for travel speed change services.

Implementation is split under `simulation.services.travel_speed_changes.*` to keep
files small and readable (see `refactor.md`) while preserving import paths.
"""

from simulation.services.travel_speed_changes import (  # noqa: F401
    MissingFieldError,
    SegmentSpeedMetricsService,
    SpeedLookupError,
    SpeedTable,
    bucket_row_index_from_signal_density,
    cap_signal_density,
    compute_flow_adjustment,
    compute_r_from_congestion,
    compute_speed_delta_after_change_for_link,
    compute_speed_delta_after_change_for_matchcode,
    compute_speed_delta_baseline_for_link,
    compute_speed_delta_baseline_for_matchcode,
    compute_speed_time_nested_response,
    compute_u_from_p_and_r,
    excel_rounddown,
    get_speed_table,
    require_fields,
    travel_speed_calc,
)

__all__ = [
    "SegmentSpeedMetricsService",
    "SpeedLookupError",
    "MissingFieldError",
    "SpeedTable",
    "get_speed_table",
    "excel_rounddown",
    "cap_signal_density",
    "bucket_row_index_from_signal_density",
    "compute_flow_adjustment",
    "compute_r_from_congestion",
    "compute_u_from_p_and_r",
    "require_fields",
    "compute_speed_delta_baseline_for_link",
    "compute_speed_delta_after_change_for_link",
    "compute_speed_delta_baseline_for_matchcode",
    "compute_speed_delta_after_change_for_matchcode",
    "compute_speed_time_nested_response",
    "travel_speed_calc",
]

