from collections import defaultdict
from datetime import datetime, timedelta, time as dtime
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Dict, List, Tuple, Set
from math import cos, radians, sqrt

from django.db.models import Min, Max
from rest_framework import status as http_status

from gtfs.models import (
    Scenario, Routes, Trips, StopTimes, Stops, Shape,
    StopNameKeywords, StopNameKeywordMap,
    StopIdKeyword, StopIdKeywordMap,
    RouteKeywords, RouteKeywordMap
)

from collections import defaultdict as _dd
from visualization.services.base import ServiceError
from visualization.constants.messages import Messages


def _extract_trip_ids(row) -> set[str]:
    """Extract trip_id values from a row payload."""
    out = set()
    if not isinstance(row, dict):
        return out

    v = row.get("trip_ids")
    if isinstance(v, list):
        for x in v:
            if x is not None:
                out.add(str(x))
    elif isinstance(v, str) and v:
        out.add(v)

    v = row.get("trips")
    if isinstance(v, list):
        for x in v:
            if x is None:
                continue
            if isinstance(x, dict):
                tid = x.get("trip_id")
                if tid:
                    out.add(str(tid))
            else:
                out.add(str(x))

    v = row.get("trip_id")
    if isinstance(v, str) and v:
        out.add(v)

    return out


def check_boarding_alighting_data(body):
    """
    Validate boarding/alighting payload against GTFS data.

    Parameters:
    - body (dict): Request payload.
    - scenario_id (str): Scenario identifier.
    - data (list[dict]): List of records with route_id/trip_id/stop_id.

    Returns:
    - tuple[dict, str]: (validation result payload, message)
    """
    body = body or {}
    scenario_id = body.get("scenario_id")
    rows = body.get("data") or []

    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    if not isinstance(rows, list):
        raise ServiceError(Messages.BA_DATA_MUST_BE_LIST_JA, "invalid data", http_status.HTTP_400_BAD_REQUEST)

    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)

    def ordered_unique(seq):
        seen = set()
        for x in seq:
            if x is None:
                continue
            s = str(x)
            if s not in seen:
                seen.add(s)
                yield s

    route_ids_in_order = list(ordered_unique([r.get("route_id") for r in rows if isinstance(r, dict)]))
    trip_ids_in_order  = list(ordered_unique([r.get("trip_id")  for r in rows if isinstance(r, dict)]))
    stop_ids_in_order  = list(ordered_unique([r.get("stop_id")  for r in rows if isinstance(r, dict)]))

    route_set = set(route_ids_in_order)
    trip_set  = set(trip_ids_in_order)
    stop_set  = set(stop_ids_in_order)

    existing_routes = set(
        Routes.objects.filter(scenario=scenario, route_id__in=route_set)
        .values_list("route_id", flat=True)
    )
    existing_trips = set(
        Trips.objects.filter(scenario=scenario, trip_id__in=trip_set)
        .values_list("trip_id", flat=True)
    )
    existing_stops = set(
        Stops.objects.filter(scenario=scenario, stop_id__in=stop_set)
        .values_list("stop_id", flat=True)
    )

    routes_out = [{"route_id": rid, "is_available": (rid in existing_routes)}
                  for rid in route_ids_in_order]
    trips_out  = [{"trip_id": tid, "is_available": (tid in existing_trips)}
                  for tid in trip_ids_in_order]
    stops_out  = [{"stop_id": sid, "is_available": (sid in existing_stops)}
                  for sid in stop_ids_in_order]

    route_id_available = {r["route_id"] for r in routes_out if r["is_available"]}

    keywords = list(RouteKeywords.objects.filter(scenario=scenario).values_list("keyword", flat=True).distinct().order_by("keyword"))

    available_keywords = set()
    if route_id_available:
        kws = RouteKeywordMap.objects.filter(
            scenario=scenario, route_id__in=list(route_id_available)
        ).values_list("keyword__keyword", flat=True).distinct()
        available_keywords = set(kws)

    keywords = [kw for kw in keywords if kw in available_keywords]


    data = {
        "routes": routes_out,
        "trips": trips_out,
        "stops": stops_out,
        "available_route_keywords": keywords
    }
    return data, Messages.BA_VALIDATION_COMPLETED_JA


def get_available_route_keywords(body):
    """
    Resolve available route keywords for the given payload.

    Parameters:
    - body (dict): Request payload.
    - scenario_id (str): Scenario identifier.
    - data (list[dict]): List of records with route_id/trip_id.

    Returns:
    - tuple[dict, str]: (available keyword payload, message)
    """
    body = body or {}
    scenario_id = body.get("scenario_id")
    rows = body.get("data") or []

    if not scenario_id:
        raise ServiceError(Messages.BA_SCENARIO_ID_REQUIRED_JA, "scenario_id missing", http_status.HTTP_400_BAD_REQUEST)
    if not isinstance(rows, list):
        raise ServiceError(Messages.BA_DATA_MUST_BE_LIST_JA, "invalid data", http_status.HTTP_400_BAD_REQUEST)

    # --- Scenario
    scenario = Scenario.objects.filter(id=scenario_id).first()
    if not scenario:
        raise ServiceError(Messages.BA_SCENARIO_NOT_FOUND_JA, "scenario not found", http_status.HTTP_404_NOT_FOUND)

    def ordered_unique(seq):
        seen = set()
        for x in seq:
            if x is None:
                continue
            s = str(x)
            if s not in seen:
                seen.add(s)
                yield s

    route_ids_in_order = list(
        ordered_unique([str(r.get("route_id")) for r in rows if isinstance(r, dict) and r.get("route_id") is not None])
    )
    route_set = set(route_ids_in_order)

    route_id_available_db = list(
        Routes.objects.filter(scenario=scenario, route_id__in=route_set)
        .values_list("route_id", flat=True)
    )
    route_id_available_db = [str(rid) for rid in route_id_available_db]

    available_set = set(route_id_available_db)
    route_id_available = [rid for rid in route_ids_in_order if rid in available_set]

    claimed_trips_by_route: dict[str, set[str]] = _dd(set)
    for r in rows:
        if not isinstance(r, dict):
            continue
        rid = r.get("route_id")
        if rid is None:
            continue
        rid = str(rid)
        tids = _extract_trip_ids(r)
        if tids:
            claimed_trips_by_route[rid].update(tids)

    matched_trips_by_route: dict[str, list[str]] = {}

    if claimed_trips_by_route:
        routes_needing_check = [rid for rid in route_id_available if rid in claimed_trips_by_route]
        if routes_needing_check:
            db_pairs = (
                Trips.objects
                .filter(scenario=scenario, route_id__in=routes_needing_check)
                .values_list("route_id", "trip_id")
            )
            existing_by_route: dict[str, set[str]] = _dd(set)
            for rid, tid in db_pairs:
                existing_by_route[str(rid)].add(str(tid))

            invalid_routes = set()
            for rid in routes_needing_check:
                claimed = claimed_trips_by_route.get(rid, set())
                dbset = existing_by_route.get(rid, set())
                matches = claimed & dbset
                if not matches:
                    invalid_routes.add(rid)
                else:
                    matched_trips_by_route[rid] = sorted(matches)

            if invalid_routes:
                route_id_available = [rid for rid in route_id_available if rid not in invalid_routes]

    if not route_id_available:
        data = {
            "available_route_keywords": [],
            "keyword_routes": [],
            "route_id_available": []
        }
        return data, Messages.BA_VALIDATION_COMPLETED_JA

    pos_index = {rid: i for i, rid in enumerate(route_id_available)}

    maps_qs = (
        RouteKeywordMap.objects
        .filter(scenario=scenario, route_id__in=route_id_available)
        .select_related("keyword")
        .values("keyword__keyword", "route_id")
        .order_by("keyword__keyword", "route_id")
    )

    keyword_to_routes = defaultdict(set)
    for m in maps_qs:
        kw = m["keyword__keyword"]
        rid = str(m["route_id"])
        keyword_to_routes[kw].add(rid)


    rid_name_rows = (
        Routes.objects
        .filter(scenario=scenario, route_id__in=route_id_available)
        .values("route_id", "route_long_name", "route_short_name")
    )
    rid_to_name = {
        str(r["route_id"]): (r.get("route_long_name") or r.get("route_short_name") or str(r["route_id"]))
        for r in rid_name_rows
    }

    available_keywords_list: list[str] = []
    if route_id_available:
        kws = (
            RouteKeywordMap.objects
            .filter(scenario=scenario, route_id__in=route_id_available)
            .values_list("keyword__keyword", flat=True)
            .distinct()
        )
        available_keywords_list = sorted(set(str(k) for k in kws if k))

    maps_qs = (
        RouteKeywordMap.objects
        .filter(scenario=scenario, route_id__in=route_id_available)
        .select_related("keyword")
        .values("keyword__keyword", "route_id")
        .order_by("keyword__keyword", "route_id")
    )
    keyword_to_routes = defaultdict(set)
    for m in maps_qs:
        kw = m["keyword__keyword"]
        rid = str(m["route_id"])
        if kw:
            keyword_to_routes[kw].add(rid)

    rid_name_rows = (
        Routes.objects
        .filter(scenario=scenario, route_id__in=route_id_available)
        .values("route_id", "route_long_name", "route_short_name")
    )
    rid_to_name = {
        str(r["route_id"]): (r.get("route_long_name") or r.get("route_short_name") or str(r["route_id"]))
        for r in rid_name_rows
    }

    keyword_routes_out = []
    for kw in available_keywords_list:
        rset = keyword_to_routes.get(kw, set())
        if not rset:
            continue
        rids_sorted = sorted(rset, key=lambda rid: pos_index.get(rid, 1_000_000))
        routes_children = []
        for rid in rids_sorted:
            routes_children.append({
                "route_id": rid,
                "route_name": rid_to_name.get(rid, rid),
                "valid_trip_ids": matched_trips_by_route.get(rid, [])
            })
        keyword_routes_out.append({
            "keyword": kw,
            "route_ids": rids_sorted,
            "routes": routes_children
        })

    data = {
        "available_route_keywords": available_keywords_list,  
        "keyword_routes": keyword_routes_out,
        "route_id_available": route_id_available
    }
    return data, Messages.BA_VALIDATION_COMPLETED_JA
