# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from decimal import Decimal
from math import floor

from django.db import connection


def get_baseline_riders_from_icagg(sim_input, route_id: str, service_id: str) -> Decimal:
    """
    Prefer pre-aggregated averages stored on SimulationInput.ic_agg.
    Returns Decimal(0) if not available.
    """
    if not sim_input or not sim_input.ic_agg:
        return Decimal("0")
    agg = sim_input.ic_agg or {}
    val = None
    if service_id in agg:
        val = agg[service_id].get(route_id)
    return Decimal(str(val)) if val is not None else Decimal("0")


def get_baseline_trips_per_day_from_gtfs(
    scenario_id: str,
    route_id: str,
    service_id: str,
) -> Decimal:
    """
    B0 = trips/day by day_type using calendar flags (0/1 ints).
    We treat weekday as any service with Mon-Fri = 1.
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)::numeric
            FROM trips t
            WHERE t.scenario_id = %s
              AND t.route_id = %s
              AND t.service_id = %s
            """,
            [scenario_id, route_id, service_id],
        )
        row = cur.fetchone()
    return Decimal(row[0] or 0)


def get_baseline_riders_per_day_from_iccard(
    ic_table: str,
    route_id: str,
    day_type: str = "weekday",
) -> Decimal:
    """
    D0 from IC boardings: sum count_geton per route/day, average by day_type.
    Assumes table has columns: date (YYYYMMDD), route_id, count_geton.
    """
    with connection.cursor() as cur:
        table = connection.ops.quote_name(ic_table)
        cur.execute(
            f"""
            WITH d AS (
              SELECT
                to_date(date::text, 'YYYYMMDD')::date AS d,
                route_id,
                SUM(count_geton)::numeric AS boardings
              FROM {table}
              WHERE route_id = %s
              GROUP BY d, route_id
            )
            SELECT AVG(boardings)::numeric
            FROM d
            WHERE CASE
                    WHEN %s='weekday' THEN EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
                    WHEN %s='saturday' THEN EXTRACT(ISODOW FROM d)=6
                    WHEN %s='sunday'   THEN EXTRACT(ISODOW FROM d)=7
                    WHEN %s='holiday'  THEN FALSE
                  END
            """,
            [route_id, day_type, day_type, day_type, day_type],
        )
        row = cur.fetchone()
    return Decimal(row[0] or 0)


def compute_delta_riders(D0: Decimal, B0: Decimal, dB: Decimal, eps: Decimal) -> int:
    """
    DeltaD = ROUNDDOWN((((dB/B0)*eps)+1)*D0 - D0, 0) (Excel-style; floor for positives)
    """
    if B0 == 0:
        return 0
    delta_ratio = (dB / B0) * eps
    val = (((delta_ratio) + Decimal("1")) * D0) - D0
    return int(floor(val))

