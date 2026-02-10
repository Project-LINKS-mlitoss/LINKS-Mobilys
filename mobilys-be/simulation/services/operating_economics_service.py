"""
Operating economics public service facade.

Keep this module stable as the import path used by views/services.
Implementation is split into smaller modules under `simulation/services/operating_economics/`
to follow `refactor.md` (smaller files, clearer responsibilities).
"""

from simulation.services.operating_economics.service import OperatingEconomicsService
from simulation.services.operating_economics.calculator import (
    compute_route_length_km_simple_mean_by_route_keyword,
    get_route_fare_from_gtfs,
    operating_economics_calc,
)

__all__ = [
    "OperatingEconomicsService",
    "compute_route_length_km_simple_mean_by_route_keyword",
    "get_route_fare_from_gtfs",
    "operating_economics_calc",
]

