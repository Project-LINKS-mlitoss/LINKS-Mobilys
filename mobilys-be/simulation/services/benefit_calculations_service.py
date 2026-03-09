# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Benefit calculations public service facade.

Keep this module stable as the import path used by other services/views/tests.
Implementation details are split into smaller modules under `simulation/services/benefit_calculations/`
to follow `refactor.md` (thin module, clear separation, easier review).
"""

from simulation.services.benefit_calculations.payload_service import BenefitCalculationsService
from simulation.services.benefit_calculations.calculator import compute_benefits_from_payload

__all__ = [
    "BenefitCalculationsService",
    "compute_benefits_from_payload",
]
