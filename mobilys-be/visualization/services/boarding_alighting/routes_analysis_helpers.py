from datetime import datetime, time as dtime
from decimal import Decimal, ROUND_HALF_UP
from math import cos, radians

from gtfs.models import Scenario, Routes
from visualization.constants.messages import Messages


def safe_int_zero(value) -> int:
    """Convert value to int, falling back to 0 on invalid input."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)

    s = str(value).strip()
    if not s or s.upper() in {"#N/A", "N/A", "NA", "NULL"}:
        return 0

    try:
        return int(s)
    except (TypeError, ValueError):
        return 0


def safe_int_or_none(value) -> int | None:
    """Convert value to int, returning None on invalid input."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)

    s = str(value).strip()
    if not s or s.upper() in {"#N/A", "N/A", "NA", "NULL"}:
        return None

    try:
        return int(s)
    except (TypeError, ValueError):
        return None


def round2(x):
    """Round a numeric value to 2 decimal places."""
    if x is None:
        return None
    return float(Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def nearest_index(lon, lat, line):
    """Find the nearest point index on a polyline."""
    best_i, best_d = 0, 1e30
    for i, (x, y) in enumerate(line):
        d = (x - lon) * (x - lon) + (y - lat) * (y - lat)
        if d < best_d:
            best_d = d
            best_i = i
    return best_i


def polyline_midpoint(coords):
    """Compute the midpoint along a polyline by length."""
    n = len(coords)
    if n == 0:
        return [0.0, 0.0]
    if n == 1:
        return coords[0]
    total = 0.0
    seglens = []
    for i in range(1, n):
        dx = coords[i][0] - coords[i - 1][0]
        dy = coords[i][1] - coords[i - 1][1]
        L = (dx * dx + dy * dy) ** 0.5
        seglens.append(L)
        total += L
    if total <= 0:
        return coords[n // 2]
    target = total / 2.0
    acc = 0.0
    for i in range(1, n):
        L = seglens[i - 1]
        if acc + L >= target:
            t = (target - acc) / L if L > 0 else 0.0
            x = coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0])
            y = coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1])
            return [x, y]
        acc += L
    return coords[-1]


def freeze_path(coords, nd=6):
    """Normalize a coordinate path to a hashable tuple."""
    return tuple(
        (round(c[0], nd), round(c[1], nd))
        for c in coords if isinstance(c, (list, tuple)) and len(c) == 2
    )


def parse_time_component(s: str) -> dtime:
    """Parse a HH:MM:SS string into a time object."""
    hh, mm, ss = map(int, s.strip().split(":"))
    return dtime(hh, mm, ss)


def parse_time_range(start_str: str | None, end_str: str | None):
    """Parse start/end time strings into a time range."""
    if not start_str and not end_str:
        return None, None
    if not start_str or not end_str:
        raise ValueError(Messages.BA_BOTH_START_END_REQUIRED_EN)
    return parse_time_component(start_str), parse_time_component(end_str)


def time_in_range(t: dtime | None, start_t: dtime | None, end_t: dtime | None) -> bool:
    """Check whether a time is within a range (supports cross-midnight)."""
    if not (start_t and end_t):
        return True
    if t is None:
        return False
    if start_t <= end_t:
        return start_t <= t <= end_t
    return t >= start_t or t <= end_t


def trip_within_range(min_dep: dtime, max_arr: dtime, start_t: dtime, end_t: dtime) -> bool:
    """Check whether a trip time window is within a range."""
    if start_t <= end_t:
        return (min_dep is not None and max_arr is not None and min_dep >= start_t and max_arr <= end_t)
    return (min_dep is not None and min_dep >= start_t) or (max_arr is not None and max_arr <= end_t)


def offset_point_east_north(
    lon: float,
    lat: float,
    east_m: float = 0.0,
    north_m: float = 0.0
) -> tuple[float, float]:
    """Offset a lon/lat by meters east/north."""
    if lon is None or lat is None:
        return lon or 0.0, lat or 0.0
    lon = float(lon)
    lat = float(lat)
    lat_rad = radians(lat)
    cos_lat = max(cos(lat_rad), 1e-6)
    dlon = east_m / (111320.0 * cos_lat)
    dlat = north_m / 110540.0
    return lon + dlon, lat + dlat


def resolve_routes(scenario: Scenario, routes_scope: set[str]) -> tuple[list[str], list[str], dict[str, str]]:
    """Resolve route ids and names for a scenario."""
    routes_sorted = sorted(list(routes_scope))
    rname_qs = (
        Routes.objects
        .filter(scenario=scenario, route_id__in=routes_sorted)
        .values("route_id", "route_short_name", "route_long_name")
    )
    route_name_by_id = {}
    for r in rname_qs:
        rid = r["route_id"]
        nm = (r.get("route_long_name") or "").strip() or (r.get("route_short_name") or "").strip() or rid
        route_name_by_id[rid] = nm
    route_names = [route_name_by_id.get(rid, rid) for rid in routes_sorted]
    return routes_sorted, route_names, route_name_by_id
