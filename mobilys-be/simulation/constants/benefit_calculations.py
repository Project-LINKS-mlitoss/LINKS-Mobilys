# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
class BenefitCalculationConstants:
    """
    This class contains constants used in benefit calculations for the simulation.
    """

    # Thresholds for different benefit levels
    THRESHOLDS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

    # Constants for calculating travel time benefits based on number of lanes
    _AF_WHEN_LANES_LT_4 = 1850.0
    _AF_WHEN_LANES_GE_4 = 1110.0
    _AG_WHEN_LANES_LT_4 = 280.0
    _AG_WHEN_LANES_GE_4 = 370.0


