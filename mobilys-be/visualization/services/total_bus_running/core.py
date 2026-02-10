from uuid import UUID
from datetime import datetime
from collections import defaultdict, Counter
from django.db.models import Min, Max, Count
from django.db.models.functions import Extract

from visualization.constants import DATE_FORMAT, TIME_FORMAT, StopGroupingMethod, Weekday
from visualization.constants.messages import Messages

from gtfs.models import (
    Scenario, Trips, StopTimes, Stops, Routes,
    Calendar, CalendarDates,
    RouteKeywords, RouteKeywordMap,
    StopNameKeywords, StopNameKeywordMap,
    StopIdKeyword, StopIdKeywordMap,
)
from gtfs.utils.route_data_utils import RouteDataUtils

def parse_params(request):
    """
    Parse and validate query parameters for total bus running endpoints.

    Parameters:
    - request (Request): DRF request with query parameters.

    Returns:
    - tuple: (date, start_time, end_time, route_group_ids, direction_id, service_ids, scenario).
    """
    date_str     = request.query_params.get('date')
    start_str    = request.query_params.get('start_time')
    end_str      = request.query_params.get('end_time')
    raw_ids      = request.query_params.get('route_group_ids')
    scenario_id  = request.query_params.get('scenario_id')
    dir_raw      = request.query_params.get('direction_id')
    raw_services = request.query_params.get('service_id')

    if not scenario_id:
        raise KeyError(Messages.TOTAL_BUS_SCENARIO_ID_REQUIRED_EN)
    try:
        scenario = Scenario.objects.get(id=scenario_id)
    except Scenario.DoesNotExist:
        raise LookupError(Messages.TOTAL_BUS_SCENARIO_NOT_FOUND_EN)

    date = None
    if date_str:
        try:
            date = datetime.strptime(date_str, DATE_FORMAT).date()
        except ValueError:
            raise ValueError(Messages.TOTAL_BUS_INVALID_DATE_EN)

    start_time = None
    if start_str:
        try:
            start_time = datetime.strptime(start_str, TIME_FORMAT).time()
        except ValueError:
            raise ValueError(Messages.TOTAL_BUS_INVALID_START_TIME_EN)

    end_time = None
    if end_str:
        try:
            end_time = datetime.strptime(end_str, TIME_FORMAT).time()
        except ValueError:
            raise ValueError(Messages.TOTAL_BUS_INVALID_END_TIME_EN)

    route_group_ids = None
    if raw_ids:
        try:
            route_group_ids = [UUID(p.strip()) for p in raw_ids.split(",") if p.strip()]
        except ValueError:
            raise ValueError(Messages.TOTAL_BUS_INVALID_ROUTE_GROUP_IDS_EN)

    direction_id = None
    if dir_raw is not None and dir_raw != "" and dir_raw != " ":
        try:
            direction_id = int(dir_raw)
        except ValueError:
            raise ValueError(Messages.TOTAL_BUS_INVALID_DIRECTION_ID_EN)

    service_ids = None
    if raw_services:
        service_ids = [s.strip() for s in raw_services.split(",") if s.strip()]

    return date, start_time, end_time, route_group_ids, direction_id, service_ids, scenario


def filter_trips(scenario, service_ids, direction_id, route_group_ids):
    """
    Filter trips by service IDs, direction, and route groups.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - service_ids (list[str]|None): Service IDs to include.
    - direction_id (int|None): Direction filter.
    - route_group_ids (list[UUID]|None): Route group filter.

    Returns:
    - QuerySet[Trips]: Filtered trips.
    """
    qs = Trips.objects.filter(scenario=scenario)
    if service_ids:
        qs = qs.filter(service_id__in=service_ids)
    if direction_id is not None:
        qs = qs.filter(direction_id=direction_id)
    if route_group_ids:
        allowed = RouteKeywordMap.objects.filter(
            scenario=scenario,
            keyword_id__in=route_group_ids
        ).values_list("route_id", flat=True)
        qs = qs.filter(route_id__in=allowed)
    return qs


def apply_calendar(trip_qs, scenario, date):
    """
    Apply calendar and calendar_dates rules to filter trips by date.

    Parameters:
    - trip_qs (QuerySet[Trips]): Trips to filter.
    - scenario (Scenario): Scenario instance.
    - date (datetime.date): Service date.

    Returns:
    - QuerySet[Trips]: Trips valid on the date.
    """
    wd = list(Weekday)[date.weekday()].value
    base    = Calendar.objects.filter(
                  scenario=scenario,
                  start_date__lte=date,
                  end_date__gte=date,
                  **{wd:1}
              ).values_list("service_id", flat=True)
    added   = CalendarDates.objects.filter(
                  scenario=scenario, date=date, exception_type=1
              ).values_list("service_id", flat=True)
    removed = CalendarDates.objects.filter(
                  scenario=scenario, date=date, exception_type=2
              ).values_list("service_id", flat=True)
    valid   = set(base) | set(added) - set(removed)
    return trip_qs.filter(service_id__in=valid)


def apply_time_window(trip_qs, scenario, start_time, end_time):
    """
    Filter trips to those within an optional time window.

    Parameters:
    - trip_qs (QuerySet[Trips]): Trips to filter.
    - scenario (Scenario): Scenario instance.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.

    Returns:
    - tuple: (filtered trips, valid_trip_ids).
    """
    if start_time or end_time:
        agg = StopTimes.objects.filter(
                  scenario=scenario,
                  trip_id__in=trip_qs.values_list("trip_id",flat=True)
              ).values("trip_id").annotate(
                  earliest=Min("arrival_time"),
                  latest=  Max("departure_time")
              )
        if start_time:
            agg = agg.filter(earliest__gte=start_time)
        if end_time:
            agg = agg.filter(latest__lte=end_time)
        valid_tids = list(agg.values_list("trip_id",flat=True))
        return trip_qs.filter(trip_id__in=valid_tids), valid_tids
    else:
        valid_tids = list(trip_qs.values_list("trip_id",flat=True))
        return trip_qs, valid_tids


def build_trip_map(trip_qs):
    """
    Build a map from trip_id to route_id.

    Parameters:
    - trip_qs (QuerySet[Trips]): Trips to map.

    Returns:
    - dict: trip_id -> route_id.
    """
    return {
        tid: rid
        for tid, rid in trip_qs.values_list("trip_id","route_id")
    }


def build_trip_pattern_maps(scenario, trip_qs):
    """
    Build lookup structures that associate trips with their route patterns.
    """
    trip_to_pattern = {}
    pattern_details = {}
    sample_trip_for_pattern = {}

    for trip in trip_qs:
        route_id = trip.route_id
        shape_id = trip.shape_id or ""
        direction_id = trip.direction_id if trip.direction_id is not None else 0
        service_id = trip.service_id or ""
        pattern_id = RouteDataUtils.make_pattern_id(
            route_id,
            shape_id,
            direction_id,
            service_id,
        )

        trip_to_pattern[trip.trip_id] = pattern_id

        if pattern_id not in pattern_details:
            pattern_details[pattern_id] = {
                "pattern_id": pattern_id,
                "route_id": route_id,
                "shape_id": shape_id,
                "direction_id": direction_id,
                "service_id": service_id,
                "is_direction_id_generated": getattr(trip, "is_direction_id_generated", False),
            }
            sample_trip_for_pattern[pattern_id] = trip.trip_id

    if not sample_trip_for_pattern:
        return trip_to_pattern, pattern_details

    sample_trip_ids = list(sample_trip_for_pattern.values())
    stop_rows = StopTimes.objects.filter(
        scenario=scenario,
        trip_id__in=sample_trip_ids
    ).values("trip_id", "stop_id", "stop_sequence")

    first_last = {}
    for row in stop_rows:
        tid = row["trip_id"]
        seq = row["stop_sequence"]
        sid = row["stop_id"]
        info = first_last.setdefault(tid, {"first": (seq, sid), "last": (seq, sid)})
        if seq < info["first"][0]:
            info["first"] = (seq, sid)
        if seq > info["last"][0]:
            info["last"] = (seq, sid)

    if first_last:
        needed_stop_ids = {
            data[idx][1]
            for data in first_last.values()
            for idx in ("first", "last")
        }
        stop_name_map = dict(
            Stops.objects.filter(
                scenario=scenario,
                stop_id__in=needed_stop_ids
            ).values_list("stop_id", "stop_name")
        )

        for pattern_id, sample_tid in sample_trip_for_pattern.items():
            info = first_last.get(sample_tid)
            if not info:
                continue
            first_sid = info["first"][1]
            last_sid = info["last"][1]
            first_name = stop_name_map.get(first_sid, "")
            last_name = stop_name_map.get(last_sid, "")

            pattern_details[pattern_id].update({
                "first_stop_id": first_sid,
                "last_stop_id": last_sid,
                "segment": f"{first_name or first_sid} - {last_name or last_sid}" if (first_name or last_name) else "",
            })

    return trip_to_pattern, pattern_details


def build_route_details(scenario, route_ids):
    """
    Load route metadata for the provided route IDs within a scenario.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - route_ids (Iterable[str]): Route IDs to load.

    Returns:
    - dict: route_id -> route metadata.
    """
    if not route_ids:
        return {}
    route_ids = {str(rid) for rid in route_ids if rid}
    if not route_ids:
        return {}
    routes_qs = Routes.objects.filter(
        scenario=scenario,
        route_id__in=route_ids
    )
    details = {}
    for route in routes_qs:
        rid = str(route.route_id)
        details[rid] = {
            "route_id": rid,
            "route_short_name": getattr(route, "route_short_name", rid),
            "route_long_name": getattr(route, "route_long_name", ""),
            "route_type": getattr(route, "route_type", None),
            "agency_id": getattr(route, "agency_id", None),
        }
    return details


def get_all_st(scenario, valid_tids):
    """
    Fetch StopTimes for valid trips in a scenario.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - valid_tids (list[str]): Valid trip IDs.

    Returns:
    - QuerySet[StopTimes]: StopTimes for valid trips.
    """
    return StopTimes.objects.filter(
        scenario=scenario,
        trip_id__in=valid_tids
    )


def compute_route_groups(scenario, route_group_ids=None):
    """
    Build route group metadata and route-group mappings.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - route_group_ids (list[UUID]|None): Optional filter.

    Returns:
    - tuple: (kw_objs, grp2routes, routes_group).
    """
    qs = RouteKeywords.objects.filter(scenario=scenario)
    if route_group_ids:
        qs = qs.filter(id__in=route_group_ids)
    kw_objs = {kw.id:kw for kw in qs}
    rmap = RouteKeywordMap.objects.filter(scenario=scenario)
    if route_group_ids:
        rmap = rmap.filter(keyword_id__in=route_group_ids)
    grp2routes = defaultdict(list)
    for m in rmap.values("keyword_id","route_id"):
        grp2routes[m["keyword_id"]].append(m["route_id"])
    routes_group = [
        {
            "route_group_id":   str(gid),
            "route_group_name": kw_objs[gid].keyword,
            "color":            f"#{kw_objs[gid].keyword_color}"
        }
        for gid in grp2routes
    ]
    return kw_objs, grp2routes, routes_group


def compute_route_group_graph(all_st, trip_map, kw_objs, grp2routes):
    """
    Compute route frequencies grouped by route group.

    Parameters:
    - all_st (QuerySet[StopTimes]): StopTimes for valid trips.
    - trip_map (dict): trip_id -> route_id.
    - kw_objs (dict): group_id -> RouteKeyword.
    - grp2routes (dict): group_id -> route list.

    Returns:
    - list[dict]: Route group graph data.
    """
    valid_trip_ids = set(all_st.values_list("trip_id", flat=True))

    cnt_per_route = Counter(
        trip_map[tid]
        for tid in valid_trip_ids
        if tid in trip_map
    )

    out = []
    for gid, routes in grp2routes.items():
        out.append({
            "group_name": kw_objs[gid].keyword,
            "childs": [
                {
                    "name": r,
                    "frequency": cnt_per_route.get(r, 0)
                } for r in routes
            ]
        })
    return out


def compute_stop_group_graph(scenario, all_st):
    """
    Compute stop frequencies grouped by stop group.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - all_st (QuerySet[StopTimes]): StopTimes for valid trips.

    Returns:
    - dict: Stop group graph payload.
    """
    use_name = scenario.stops_grouping_method == StopGroupingMethod.STOP_NAME
    KM       = StopNameKeywords    if use_name else StopIdKeyword
    MM       = StopNameKeywordMap  if use_name else StopIdKeywordMap
    kw_attr  = "stop_name_keyword" if use_name else "stop_id_keyword"
    fld      = "stop_name_group_id" if use_name else "stop_id_group_id"

    name_map  = {kw.stop_group_id: getattr(kw,kw_attr) for kw in KM.objects.filter(scenario=scenario)}
    grp2stops = defaultdict(list)
    for m in MM.objects.filter(scenario=scenario).values(fld,"stop_id"):
        name = name_map.get(int(m[fld]))
        if name:
            grp2stops[name].append(m["stop_id"])

    stops_counts = Counter(rec.stop_id for rec in all_st)
    return {
        "grouping_method": "停留所名" if use_name else "停留所ID",
        "group_data": [
            {
                "parent": p,
                "childs": [
                    {"name": sid, "frequency": stops_counts.get(sid,0)}
                    for sid in sids
                ]
            }
            for p, sids in grp2stops.items()
        ]
    }


def compute_route_group_total_graph(scenario, all_st, trip_map, grp2routes, kw_objs, start_time, end_time):
    """
    Compute per-hour counts for each route group.

    Parameters:
    - scenario (Scenario): Scenario instance.
    - all_st (QuerySet[StopTimes]): StopTimes for valid trips.
    - trip_map (dict): trip_id -> route_id.
    - grp2routes (dict): group_id -> route list.
    - kw_objs (dict): group_id -> RouteKeyword.
    - start_time (datetime.time|None): Window start.
    - end_time (datetime.time|None): Window end.

    Returns:
    - list[dict]: Hourly graph payload.
    """
    start_hr = start_time.hour if start_time else 0
    end_hr   = end_time.hour   if end_time   else 23

    valid_tids = set(all_st.values_list("trip_id",flat=True))
    qs = StopTimes.objects.filter(
        scenario=scenario,
        trip_id__in=valid_tids
    ).values("trip_id").annotate(earliest_dep=Min("departure_time"))
    trip_hours = {item["trip_id"]: item["earliest_dep"].hour for item in qs}

    r2g = defaultdict(list)
    for gid, routes in grp2routes.items():
        for r in routes:
            r2g[r].append(kw_objs[gid].keyword)

    hr_counts = {g:Counter() for grp in r2g.values() for g in grp}
    for tid, hr in trip_hours.items():
        if start_hr <= hr <= end_hr:
            rid = trip_map[tid]
            for g in r2g.get(rid,[]):
                hr_counts[g][hr] += 1

    name2color = {kw.keyword:kw.keyword_color for kw in kw_objs.values()}
    all_groups  = sorted(hr_counts.keys())

    result = []
    for h in range(start_hr, end_hr+1):
        result.append({
            "hour": f"{h:02d}:00",
            "groups": [
                {
                    "name":  g,
                    "value": hr_counts[g].get(h,0),
                    "color": f"#{name2color[g]}"
                }
                for g in all_groups
            ]
        })
    return result
