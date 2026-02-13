# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from typing import Any, Dict, Optional

from simulation.models import Simulation, SimulationInput
from simulation.services.base import log_service_call
from simulation.services.simulation_init.analysis import analyze_ic_csv_against_simulation

@log_service_call
def run_csv_validation(
    file_obj,
    *,
    simulation: Simulation,
    simulation_input: Optional[SimulationInput] = None,
) -> Dict[str, Any]:
    """
    Adapter that reuses analyze_ic_csv_against_simulation() to produce the format
    expected by your new persistence pipeline.
    """

    # Use the existing logic
    analysis = analyze_ic_csv_against_simulation(file_obj, simulation=simulation)

    # Normalize to the new schema
    return {
        "trip_count_comparisons": analysis.get("trip_count_comparisons", []),
        "invalid_rows": analysis.get("invalid_rows", []),
        "service_date": analysis.get("service_date") or "",
        "service_ids": analysis.get("service_ids") or [],
        "source_file": {
            "name": getattr(file_obj, "name", ""),
            "size": getattr(file_obj, "size", None),
        },
    }

