# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Backward-compatible facade for simulation init + CSV validation utilities.

The implementation is split under `simulation.services.simulation_init.*` to keep
modules small and readable per `refactor.md`, while preserving existing import
paths from views/services.
"""

from simulation.services.simulation_init import (
    CSVTemplateError,
    SimulationDoesntHaveDifferentError,
    SimulationInitService,
    _build_ic_agg_from_csv,
    _get_field,
    _get_scenario_obj,
    _parse_date_flexible,
    _req_float_form,
    _validate_ic_csv_file,
    _validate_service_ids_for_date,
    analyze_ic_csv_against_simulation,
    enrich_validation_result_with_patterns,
    run_csv_validation,
)

__all__ = [
    "SimulationInitService",
    "_validate_service_ids_for_date",
    "CSVTemplateError",
    "SimulationDoesntHaveDifferentError",
    "_validate_ic_csv_file",
    "_build_ic_agg_from_csv",
    "_get_scenario_obj",
    "_parse_date_flexible",
    "_get_field",
    "_req_float_form",
    "analyze_ic_csv_against_simulation",
    "run_csv_validation",
    "enrich_validation_result_with_patterns",
]
