"""
CO2 public service facade.

Keep this module stable as the import path used by views/services.
Implementation is split into smaller modules under `simulation/services/co2/`
to follow `refactor.md` (smaller files, clearer responsibilities).
"""

from simulation.services.co2.service import CO2Service
from simulation.services.co2.calculator import (
    aggregate_totals_from_rows,
    co2_calc_and_persist_routewise,
    co2_calc_and_persist,
)

__all__ = [
    "CO2Service",
    "aggregate_totals_from_rows",
    "co2_calc_and_persist_routewise",
    "co2_calc_and_persist",
]

