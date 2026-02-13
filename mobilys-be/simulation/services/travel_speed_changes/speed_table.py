# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import bisect
import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Optional


class SpeedLookupError(Exception):
    """Lookup table problems (missing file, out-of-range headers/rows)."""


@dataclass(frozen=True)
class SpeedTable:
    headers: List[float]
    rows: List[List[Optional[float]]]

    def _hlookup_data_row(self, value: float, data_row_index: int) -> float:
        """
        Approximate HLOOKUP at column 'value' using a 1-based data row index.
        data_row_index=1 is the first data row under the header.
        """
        if not (1 <= data_row_index <= len(self.rows)):
            raise SpeedLookupError(
                f"data_row_index={data_row_index} out of range (1..{len(self.rows)})"
            )

        col = bisect.bisect_right(self.headers, value) - 1
        if col < 0:
            raise SpeedLookupError(f"value={value} < min header {self.headers[0]}")

        cell = self.rows[data_row_index - 1][col]
        if cell is None:
            raise SpeedLookupError(
                f"Missing value at row={data_row_index}, header={self.headers[col]}"
            )
        return float(cell)

    def compute_combo_excel(self, value: float, row_index_excel: int, multiplier: float) -> float:
        """
        Excel:
          HLOOKUP(value, table, T) * multiplier + HLOOKUP(value, table, T+1)
        """
        if not (2 <= row_index_excel <= len(self.rows)):
            raise SpeedLookupError(
                f"row_index_excel={row_index_excel} out of range (valid 2..{len(self.rows)})"
            )

        v1 = self._hlookup_data_row(value, row_index_excel - 1)
        v2 = self._hlookup_data_row(value, row_index_excel)
        return v1 * multiplier + v2


@lru_cache(maxsize=1)
def get_speed_table() -> SpeedTable:
    """Load the JSON lookup table from simulation/services/data/speed_table.json."""
    data_path = Path(__file__).resolve().parent.parent / "data" / "speed_table.json"
    if not data_path.exists():
        raise SpeedLookupError(f"speed_table.json not found at {data_path}")
    data = json.loads(data_path.read_text(encoding="utf-8"))
    return SpeedTable(headers=data["headers"], rows=data["rows"])


def excel_rounddown(x: float, digits: int = 0) -> float:
    """Excel ROUNDDOWN (towards zero)."""
    scale = 10 ** digits
    return math.trunc(x * scale) / scale


def cap_signal_density(signal_density_per_km: float) -> float:
    """S = min(signal_density_per_km, 4)."""
    return 4.0 if signal_density_per_km > 4 else float(signal_density_per_km)


def bucket_row_index_from_signal_density(s_capped: float) -> int:
    """
    Map S (capped) to Excel row index (header=1):
      IF(S=0,2, IF(S<=0.5,4, IF(S<=1,6, IF(S<=2,8, IF(S<=4,10)))))
    """
    if s_capped == 0:
        return 2
    if s_capped <= 0.5:
        return 4
    if s_capped <= 1:
        return 6
    if s_capped <= 2:
        return 8
    return 10


def compute_flow_adjustment(change_in_flow: float, congestion_index: float, traffic24_total: float) -> float:
    """P = change_in_flow * congestion_index / traffic24_total (0 if denominator=0)."""
    if traffic24_total == 0:
        return 0.0
    return (change_in_flow * congestion_index) / traffic24_total


def compute_r_from_congestion(congestion_index: float) -> float:
    """R = ROUNDDOWN(max(congestion_index, 0.5), 1)."""
    inner = 0.5 if congestion_index < 0.5 else congestion_index
    return excel_rounddown(inner, 1)


def compute_u_from_p_and_r(flow_adjustment: float, r_value: float) -> float:
    """U = ROUNDDOWN(IF(P<0.5,0.5,IF(R>2,2,P)), 1)."""
    inner = 0.5 if flow_adjustment < 0.5 else (2.0 if r_value > 2 else flow_adjustment)
    return excel_rounddown(inner, 1)

