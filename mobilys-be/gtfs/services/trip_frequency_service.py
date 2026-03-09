# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# gtfs/services/trip_frequency_service.py
from collections import defaultdict, Counter
from datetime import datetime, time, timedelta
from itertools import zip_longest
import uuid

from gtfs.utils.scenario_utils import update_scenario_edit_state
from rest_framework import status
from rest_framework.response import Response
from django.db import models

from gtfs.constants import ErrorMessages
from gtfs.models import (
    RouteKeywords,
    RouteKeywordMap,
    Routes,
    Trips,
    StopTimes,
    Stops,
    Calendar,
    CalendarDates,  
    Shape
)
from gtfs.utils.route_data_utils import RouteDataUtils
from mobilys_BE.shared.response import BaseResponse
from gtfs.serializers.response.trip_response import TripSerializer
from gtfs.services.base import log_service_call, transactional


class _TripFrequencyProcessor:
    """
    GET  : groups -> routes -> trips_pattern (per shape_id)
    POST : add/remove frequency at the level of (route_id, direction_id, service_id [, shape_id?])
        ADD:
            - current_interval == 1:
                * batch 15/15/15: 60m → 30m → 15m (≥31 remains 15m)
                * wrap >22:00 → 06:MM (MM follows the reference trip)
                * AVOID DUPLICATES: if the time already exists, skip again with the same step
                * seconds always 00
            - current_interval > 1: evenly spaced in [first_dep, last_dep]
        DELETE:
            - Protect the first & last trip
            - Remove the one with the smallest "adjacent gap" (gap_prev + gap_next; tie-breaker: earlier time)
            - Iterative & give a warning if unable to delete as requested
    """

    INCLUDE_ALL_CALENDAR_SERVICES = True
    MIN_GAP_MINUTES = 10

    # Extended time configuration for same-day service
    # Times 00:00-03:59 are treated as 24:00-26:59 (continuation of service day)
    EXTENDED_CUTOFF_HOUR = 3   # Hours < 3 are treated as extended (24:00+)
    MAX_EXTENDED_HOUR = 27     # Maximum hour: 27:00
    MAX_EXTENDED_MINUTES = 27 * 60  # 1560 minutes (exactly 27:00:00)

    # =========================
    # ===== Extended Time =====
    # =========================
    
    def _to_minutes(self, t: time, is_next_day: bool = False) -> int:
        """
        Convert time to minutes for same-day service logic.
        
        IMPORTANT: Times 00:00-03:59 are ALWAYS treated as 24:00-27:59 
        (continuation of service day), regardless of is_next_day flag.
        
        This ensures that early morning trips (e.g., 01:00) are sorted AFTER 
        late night trips (e.g., 23:00) as they belong to the same service day.
        
        Examples:
            - 06:00 (any flag) → 360 minutes
            - 23:00 (any flag) → 1380 minutes
            - 01:00 (any flag) → 1500 minutes (25:00)
            - 03:00 (any flag) → 1620 minutes (27:00)
        """
        minutes = t.hour * 60 + t.minute
        
        # Early morning hours (00:00-03:59) are ALWAYS treated as extended time
        # This implements same-day service logic where these times are 
        # continuation of the previous calendar day's service
        if t.hour < self.EXTENDED_CUTOFF_HOUR:
            minutes += 1440  # Add 24 hours
        
        return minutes

    def _from_minutes(self, total_minutes: int) -> tuple[time, bool]:
        """
        Convert minutes from service start to (time, is_next_day).
        
        Times >= 1440 (24:00+) are stored with is_next_day=True.
        Capped at MAX_EXTENDED_MINUTES (27:00 = 1620 minutes).
        
        Returns:
            tuple: (time object, is_next_day flag)
        """
        # Cap at maximum extended time (27:00)
        if total_minutes > self.MAX_EXTENDED_MINUTES:
            total_minutes = self.MAX_EXTENDED_MINUTES
        
        # Handle negative minutes (edge case)
        if total_minutes < 0:
            total_minutes = 0
        
        is_next_day = total_minutes >= 1440
        if is_next_day:
            total_minutes -= 1440
        
        hours, minutes = divmod(total_minutes, 60)
        return time(hour=hours, minute=minutes, second=0), is_next_day

    def _is_within_extended_limit(self, t: time, is_next_day: bool = False) -> bool:
        """
        Check if time is within the extended time limit (max 27:00).
        Uses same-day service logic.
        """
        total_minutes = self._to_minutes(t, is_next_day)
        return total_minutes <= self.MAX_EXTENDED_MINUTES

    def _to_dt_extended(self, t: time, is_next_day: bool = False) -> datetime:
        """
        Convert time to datetime using same-day service logic.
        Early morning times are treated as next day.
        """
        base = datetime.combine(datetime.today(), t)
        # Early morning is always next day in same-day service logic
        if t.hour < self.EXTENDED_CUTOFF_HOUR or is_next_day:
            base += timedelta(days=1)
        return base

    def _minutes_diff_extended(self, a_time: time, a_next_day: bool, b_time: time, b_next_day: bool) -> int:
        """
        Calculate absolute difference in minutes between two times.
        Uses same-day service logic.
        """
        a_minutes = self._to_minutes(a_time, a_next_day)
        b_minutes = self._to_minutes(b_time, b_next_day)
        return abs(a_minutes - b_minutes)

    # =========================
    # ===== Pattern Hash =====
    # =========================

    def _compute_trip_pattern_hash(self, scenario_id, trip_id) -> str | None:
        """
        Compute pattern_hash for a single trip based on its stop sequence.
        Returns the hash string or None if no stop_times found.
        """
        stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id, 
                trip_id=trip_id
            ).order_by("stop_sequence").values_list("stop_id", flat=True)
        )
        if not stop_times:
            return None
        stop_ids = [str(sid) for sid in stop_times]
        return RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)

    def _bulk_compute_pattern_hashes(self, scenario_id, trip_ids: list) -> dict:
        """
        Bulk compute pattern_hash for multiple trips.
        Returns dict: {trip_id: pattern_hash}
        """
        if not trip_ids:
            return {}
        
        # Get all stop_times for these trips in one query
        stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id__in=trip_ids
            ).order_by("trip_id", "stop_sequence").values("trip_id", "stop_id")
        )
        
        # Group by trip_id
        trip_stop_ids = defaultdict(list)
        for st in stop_times:
            trip_stop_ids[st["trip_id"]].append(str(st["stop_id"]))
        
        # Compute hash for each trip
        result = {}
        for trip_id, stop_ids in trip_stop_ids.items():
            if stop_ids:
                result[trip_id] = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)
            else:
                result[trip_id] = None
        
        return result

    # =========================
    # ========== GET ==========
    # =========================
    def retrieve(self, *, scenario_id):
        if not scenario_id:
            return BaseResponse(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_FOR_TRIP_FREQUENCY_JA,
                data=None,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_FOR_TRIP_FREQUENCY_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        keywords = list(RouteKeywords.objects.filter(scenario_id=scenario_id))
        if not keywords:
            return BaseResponse(message="OK", data=[], status_code=status.HTTP_200_OK)

        keyword_ids = [k.id for k in keywords]
        maps = list(
            RouteKeywordMap.objects.filter(
                scenario_id=scenario_id, keyword_id__in=keyword_ids
            )
        )
        route_ids = [m.route_id for m in maps]
        routes = list(
            Routes.objects.filter(scenario_id=scenario_id, route_id__in=route_ids)
        )
        route_id_to_route = {r.route_id: r for r in routes}

        # ========== FIX: Combine service_ids from Calendar AND CalendarDates ==========
        calendar_service_ids = set(
            Calendar.objects.filter(scenario_id=scenario_id).values_list(
                "service_id", flat=True
            )
        )
        calendar_dates_service_ids = set(
            CalendarDates.objects.filter(scenario_id=scenario_id).values_list(
                "service_id", flat=True
            )
        )
        all_service_ids = calendar_service_ids | calendar_dates_service_ids
        # ================================================================================

        trips = list(
            Trips.objects.filter(scenario_id=scenario_id, route_id__in=route_ids)
        )
        trip_ids = [t.trip_id for t in trips]
        stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id, trip_id__in=trip_ids
            ).order_by("trip_id", "stop_sequence")
        )

        route_id_to_trips = defaultdict(list)
        for t in trips:
            route_id_to_trips[t.route_id].append(t)

        trip_id_to_stop_times = defaultdict(list)
        for st in stop_times:
            trip_id_to_stop_times[st.trip_id].append(st)

        # stop names bulk
        stop_ids_needed = set()
        for sts in trip_id_to_stop_times.values():
            if sts:
                stop_ids_needed.add(sts[0].stop_id)
                stop_ids_needed.add(sts[-1].stop_id)
        stop_id_to_name = {
            s.stop_id: s.stop_name
            for s in Stops.objects.filter(
                scenario_id=scenario_id, stop_id__in=stop_ids_needed
            )
        }

        # Build groups
        groups_payload = []
        for kw in keywords:
            kw_route_ids = [m.route_id for m in maps if m.keyword_id == kw.id]
            kw_routes = [
                route_id_to_route[rid] for rid in kw_route_ids if rid in route_id_to_route
            ]

            routes_payload = []
            for r in kw_routes:
                trips_for_route = route_id_to_trips.get(r.route_id, [])

                # Aggregate patterns using hashed stop sequences
                pattern_count4 = defaultdict(int)
                pattern_pair_counter4 = defaultdict(Counter)
                pattern_headsign_counter4 = defaultdict(Counter)
                pattern_shape_map = {}
                directions_seen = set()
                services_seen_on_route = set()
                patterns_per_dir_svc = defaultdict(set)

                for t in trips_for_route:
                    sts = trip_id_to_stop_times.get(t.trip_id, [])
                    if not sts:
                        continue
                    first_stop_name = stop_id_to_name.get(sts[0].stop_id, "")
                    last_stop_name = stop_id_to_name.get(sts[-1].stop_id, "")
                    pair = f"{first_stop_name} - {last_stop_name}"
                    stop_ids = [str(st.stop_id) for st in sts]
                    pattern_hash = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)
                    is_direction_id_generated = t.is_direction_id_generated or False
                    headsign = t.trip_headsign or ""
                    key4 = (r.route_id, t.direction_id, t.service_id, pattern_hash)

                    pattern_count4[key4] += 1
                    pattern_pair_counter4[key4][pair] += 1
                    pattern_headsign_counter4[key4][headsign] += 1
                    pattern_shape_map.setdefault(key4, t.shape_id)

                    directions_seen.add(t.direction_id)
                    services_seen_on_route.add(t.service_id)
                    patterns_per_dir_svc[(t.direction_id, t.service_id)].add(pattern_hash)

                if not directions_seen:
                    route_payload = self._model_to_dict_all_fields(r)
                    route_payload["trips_pattern"] = []
                    routes_payload.append(route_payload)
                    continue

                candidate_services = (
                    sorted(all_service_ids)
                    if self.INCLUDE_ALL_CALENDAR_SERVICES
                    else sorted(services_seen_on_route)
                )

                rows = []
                for direction in sorted(directions_seen, key=lambda x: (x is None, x)):
                    fb_pair_counter = Counter()
                    fb_headsign_counter = Counter()
                    for svc in candidate_services:
                        for pattern_hash in patterns_per_dir_svc.get((direction, svc), []):
                            k4 = (r.route_id, direction, svc, pattern_hash)
                            fb_pair_counter += pattern_pair_counter4.get(k4, Counter())
                            fb_headsign_counter += pattern_headsign_counter4.get(k4, Counter())

                    fallback_pair = fb_pair_counter.most_common(1)[0][0] if fb_pair_counter else ""
                    fallback_headsign = (
                        fb_headsign_counter.most_common(1)[0][0] if fb_headsign_counter else ""
                    )

                    for service in candidate_services:
                        patterns_here = sorted(
                            patterns_per_dir_svc.get((direction, service), set()),
                            key=lambda x: (x is None, x),
                        )
                        if not patterns_here:
                            rows.append({
                                "trip_id": f"{r.route_id}:{direction}:{service}:null",
                                "route_id": r.route_id,
                                "service_id": service,
                                "is_direction_id_generated": is_direction_id_generated,
                                "direction_id": direction,
                                "shape_id": None,
                                "first_and_last_stop_name": fallback_pair,
                                "trip_headsign": fallback_headsign,
                                "interval": 0,
                                "pattern_hash": None,  # Include pattern_hash in response
                            })
                            continue

                        for pattern_hash in patterns_here:
                            k4 = (r.route_id, direction, service, pattern_hash)
                            interval = pattern_count4.get(k4, 0)
                            if interval > 0:
                                first_last = pattern_pair_counter4[k4].most_common(1)[0][0]
                                headsign = pattern_headsign_counter4[k4].most_common(1)[0][0]
                            else:
                                first_last = fallback_pair
                                headsign = fallback_headsign

                            rows.append(
                                {
                                    "trip_id": f"{r.route_id}:{direction}:{service}:{pattern_hash or 'null'}",
                                    "route_id": r.route_id,
                                    "service_id": service,
                                    "is_direction_id_generated": is_direction_id_generated,
                                    "direction_id": direction,
                                    "shape_id": pattern_shape_map.get(k4),
                                    "first_and_last_stop_name": first_last,
                                    "trip_headsign": headsign,
                                    "interval": interval,
                                    "pattern_hash": pattern_hash,  # Include pattern_hash in response
                                }
                            )

                rows.sort(
                    key=lambda x: (
                        x["direction_id"] is None,
                        x["direction_id"],
                        x["service_id"],
                        x.get("shape_id") is None,
                        x.get("shape_id"),
                    )
                )
                for row in rows:
                    row["pattern_id"] = RouteDataUtils.make_pattern_id(
                        r.route_id,
                        row.get("pattern_hash"),
                        row["direction_id"],
                        row["service_id"],
                    )

                route_payload = self._model_to_dict_all_fields(r)
                route_payload["trips_pattern"] = rows
                routes_payload.append(route_payload)

            groups_payload.append(
                {
                    "group_route_id": str(kw.id),
                    "group_route_name": kw.keyword,
                    "routes": routes_payload,
                }
            )

        return BaseResponse(
            message="ルートパターンが正常に取得されました。",
            data=groups_payload,
            status_code=status.HTTP_200_OK,
        )

    # ==========================
    # ====== Utilities POST =====
    # ==========================
    def _to_dt(self, t: time) -> datetime:
        return datetime.combine(datetime.today(), t)

    def _truncate_seconds(self, t: time) -> time:
        return t.replace(second=0, microsecond=0)

    def _minutes_diff(self, a: time, b: time) -> int:
        return abs(int((self._to_dt(a) - self._to_dt(b)).total_seconds() // 60))

    def _first_departure(self, scenario_id, trip_id) -> tuple[time, bool] | tuple[None, None]:
        """
        Get first departure time with next_day flag.
        Returns (departure_time, is_departure_time_next_day) or (None, None).
        """
        st = (
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id=trip_id)
            .order_by("stop_sequence")
            .values("departure_time", "is_departure_time_next_day")
            .first()
        )
        if st:
            return st["departure_time"], st.get("is_departure_time_next_day", False)
        return None, None

    def _get_route_direction_trips(
        self, scenario_id, route_id, direction_id, service_id=None, shape_id=None, pattern_hash=None
    ):
        """
        Get trips sorted by extended departure time (same-day service logic).
        Filters by pattern_hash if provided.
        Returns list of (Trip, departure_time, is_next_day).
        """
        q = Trips.objects.filter(
            scenario_id=scenario_id, 
            route_id=route_id
        )
        
        # Handle direction_id (can be 0, 1, or None)
        if direction_id is not None:
            q = q.filter(direction_id=direction_id)
        else:
            q = q.filter(direction_id__isnull=True)
        
        # Handle service_id
        if service_id is not None and service_id != "":
            q = q.filter(service_id=service_id)
        
        # Handle shape_id - truthy check for consistency
        if shape_id:
            q = q.filter(shape_id=shape_id)

        trips = list(q)
        
        # If pattern_hash is provided, filter trips by pattern
        if pattern_hash:
            trip_ids = [t.trip_id for t in trips]
            trip_pattern_hashes = self._bulk_compute_pattern_hashes(scenario_id, trip_ids)
            trips = [t for t in trips if trip_pattern_hashes.get(t.trip_id) == pattern_hash]
        
        with_times = []
        for t in trips:
            dep_time, is_next_day = self._first_departure(scenario_id, t.trip_id)
            if dep_time is not None:
                with_times.append((t, dep_time, is_next_day))

        # Sort by extended time (same-day service logic)
        with_times.sort(key=lambda x: self._to_minutes(x[1], x[2]))
        return with_times

    def _pick_template_trip(
        self, scenario_id, route_id, direction_id, exclude_service_id=None, prefer_shape_id=None, pattern_hash=None
    ):
        """
        Pick a template trip for cloning.
        Returns (Trip, departure_time, is_next_day) or (None, None, None).
        """
        q = Trips.objects.filter(
            scenario_id=scenario_id, route_id=route_id
        )
        
        # Handle direction_id
        if direction_id is not None:
            q = q.filter(direction_id=direction_id)
        else:
            q = q.filter(direction_id__isnull=True)
        
        if exclude_service_id:
            q = q.exclude(service_id=exclude_service_id)

        search_orders = []
        if prefer_shape_id:
            search_orders.append(q.filter(shape_id=prefer_shape_id))
        search_orders.append(q)

        for cand_q in search_orders:
            candidates = []
            trips_list = list(cand_q)
            
            # If pattern_hash provided, filter by pattern
            if pattern_hash:
                trip_ids = [t.trip_id for t in trips_list]
                trip_pattern_hashes = self._bulk_compute_pattern_hashes(scenario_id, trip_ids)
                trips_list = [t for t in trips_list if trip_pattern_hashes.get(t.trip_id) == pattern_hash]
            
            for t in trips_list:
                dep_time, is_next_day = self._first_departure(scenario_id, t.trip_id)
                if dep_time is not None:
                    candidates.append((t, dep_time, is_next_day))
            # Sort by extended time (same-day service logic)
            candidates.sort(key=lambda x: self._to_minutes(x[1], x[2]))
            if candidates:
                return candidates[0]

        return (None, None, None)

    def _clone_trip_shifted(
        self,
        scenario_id,
        template_trip: Trips,
        template_departure: time,
        template_is_next_day: bool,
        target_departure: time,
        target_is_next_day: bool,
        new_service_id: str,
    ):
        """
        Clone a trip with shifted times, using same-day service logic.
        Respects MAX_EXTENDED_MINUTES limit (27:00).
        """
        target_departure = self._truncate_seconds(target_departure)

        # Calculate delta in minutes using same-day service logic
        template_minutes = self._to_minutes(template_departure, template_is_next_day)
        target_minutes = self._to_minutes(target_departure, target_is_next_day)
        delta_minutes = target_minutes - template_minutes

        new_trip_id = f"{template_trip.trip_id}_{uuid.uuid4().hex[:8]}"
        new_trip = Trips.objects.create(
            trip_id=new_trip_id,
            route_id=template_trip.route_id,
            service_id=new_service_id,
            trip_headsign=template_trip.trip_headsign,
            trip_short_name=template_trip.trip_short_name,
            direction_id=template_trip.direction_id,
            block_id=template_trip.block_id,
            shape_id=template_trip.shape_id,
            scenario=template_trip.scenario,
            is_direction_id_generated=template_trip.is_direction_id_generated,
        )

        sts = list(
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id=template_trip.trip_id).order_by(
                "stop_sequence"
            )
        )
        new_sts = []
        for st in sts:
            # Convert arrival to extended minutes, add delta, convert back
            arr_minutes = self._to_minutes(st.arrival_time, st.is_arrival_time_next_day)
            new_arr_minutes = arr_minutes + delta_minutes
            # Cap at MAX_EXTENDED_MINUTES (27:00)
            new_arr_minutes = min(new_arr_minutes, self.MAX_EXTENDED_MINUTES)
            new_arr_time, new_arr_next_day = self._from_minutes(new_arr_minutes)

            # Convert departure to extended minutes, add delta, convert back
            dep_minutes = self._to_minutes(st.departure_time, st.is_departure_time_next_day)
            new_dep_minutes = dep_minutes + delta_minutes
            # Cap at MAX_EXTENDED_MINUTES (27:00)
            new_dep_minutes = min(new_dep_minutes, self.MAX_EXTENDED_MINUTES)
            new_dep_time, new_dep_next_day = self._from_minutes(new_dep_minutes)

            new_sts.append(
                StopTimes(
                    trip_id=new_trip_id,
                    arrival_time=new_arr_time,
                    departure_time=new_dep_time,
                    stop_id=st.stop_id,
                    stop_sequence=st.stop_sequence,
                    stop_headsign=st.stop_headsign,
                    pickup_type=st.pickup_type,
                    drop_off_type=st.drop_off_type,
                    shape_dist_traveled=st.shape_dist_traveled,
                    scenario=st.scenario,
                    is_arrival_time_next_day=new_arr_next_day,
                    is_departure_time_next_day=new_dep_next_day,
                )
            )
        StopTimes.objects.bulk_create(new_sts)
        return new_trip

    # ---------- Evenly spaced (general case, interval > 1) ----------
    def _even_grid_times_extended(
        self, start_time: time, start_next_day: bool,
        end_time: time, end_next_day: bool,
        slots: int
    ) -> list[tuple[time, bool]]:
        """
        Generate evenly spaced times between start and end, using same-day service logic.
        Returns list of (time, is_next_day) tuples.
        Capped at MAX_EXTENDED_MINUTES (27:00).
        """
        if slots <= 0:
            return []

        start_minutes = self._to_minutes(start_time, start_next_day)
        end_minutes = self._to_minutes(end_time, end_next_day)

        # Cap at maximum (27:00)
        end_minutes = min(end_minutes, self.MAX_EXTENDED_MINUTES)
        start_minutes = min(start_minutes, self.MAX_EXTENDED_MINUTES)

        # Ensure start < end
        if start_minutes > end_minutes:
            start_minutes, end_minutes = end_minutes, start_minutes

        total_span = end_minutes - start_minutes

        if total_span == 0:
            t, nd = self._from_minutes(start_minutes)
            return [(self._truncate_seconds(t), nd) for _ in range(slots)]

        if slots == 1:
            t, nd = self._from_minutes(start_minutes)
            return [(self._truncate_seconds(t), nd)]

        step = total_span / (slots - 1)
        out = []
        for i in range(slots):
            minutes = start_minutes + round(i * step)
            # Cap at maximum (27:00)
            minutes = min(minutes, self.MAX_EXTENDED_MINUTES)
            t, nd = self._from_minutes(minutes)
            out.append((self._truncate_seconds(t), nd))
        return out

    def _choose_new_times_even_with_existing_extended(
        self,
        start_time: time, start_next_day: bool,
        end_time: time, end_next_day: bool,
        existing_sorted: list[tuple[time, bool]],
        add_n: int
    ) -> list[tuple[time, bool]]:
        """
        Choose new times evenly distributed, avoiding existing times.
        Uses same-day service logic. Capped at MAX_EXTENDED_MINUTES (27:00).
        Returns list of (time, is_next_day) tuples.
        """
        if add_n <= 0:
            return []
        if not existing_sorted:
            return self._even_grid_times_extended(start_time, start_next_day, end_time, end_next_day, add_n)

        total_slots = len(existing_sorted) + add_n
        grid = self._even_grid_times_extended(start_time, start_next_day, end_time, end_next_day, total_slots)

        start_minutes = self._to_minutes(start_time, start_next_day)
        end_minutes = self._to_minutes(end_time, end_next_day)
        
        # Cap at maximum (27:00)
        end_minutes = min(end_minutes, self.MAX_EXTENDED_MINUTES)
        start_minutes = min(start_minutes, self.MAX_EXTENDED_MINUTES)
        
        span = end_minutes - start_minutes

        taken = set()
        gi = 0
        for t, nd in existing_sorted:
            if span <= 0:
                idx = gi
            else:
                t_minutes = self._to_minutes(t, nd)
                idx_float = (t_minutes - start_minutes) / span * (total_slots - 1)
                idx = int(round(idx_float))
            idx = max(0, min(total_slots - 1, idx))
            idx = max(idx, gi)
            while idx in taken and idx < total_slots - 1:
                idx += 1
            if idx in taken:
                back = gi
                while back in taken and back < total_slots:
                    back += 1
                idx = back if back < total_slots else idx
            taken.add(idx)
            gi = idx + 1

        new_times = [grid[i] for i in range(total_slots) if i not in taken]
        return new_times[:add_n]

    # ---------- interval==1: batch 60→30→15, wrap 22→06, avoid duplicates ----------
    def _seq_interval1_variable_step_extended(
        self,
        base_time: time,
        base_is_next_day: bool,
        add_n: int,
        existing_times: list[tuple[time, bool]],
    ) -> list[tuple[time, bool]]:
        """
        Generate add_n new times with variable step, using same-day service logic.
        """
        if add_n <= 0:
            return []

        base_time = self._truncate_seconds(base_time)
        base_min = base_time.minute
        
        # Service boundaries
        SERVICE_START_MINUTES = 6 * 60   # 06:00 = 360 minutes
        SERVICE_END_MINUTES = 22 * 60    # 22:00 = 1320 minutes

        def add_step(cur_minutes: int, step_min: int) -> int | None:
            """Add step and handle wrapping for same-day service logic."""
            new_minutes = cur_minutes + step_min
            
            # If exceeds max extended time (27:00), cannot add more
            if new_minutes > self.MAX_EXTENDED_MINUTES:
                return None
            
            # If in valid range (06:00-27:00), just return it
            # Extended times (24:00-27:00) are valid!
            if new_minutes >= SERVICE_START_MINUTES:
                return new_minutes
            
            # If below service start (< 06:00), wrap to next available slot
            # This shouldn't happen in normal operation, but handle it
            return SERVICE_START_MINUTES + base_min

        # Build set of used times
        used = {self._to_minutes(t, nd) for t, nd in existing_times}
        out = []

        # Start from base time
        cur_minutes = self._to_minutes(base_time, base_is_next_day)

        # Variable step tiers: 60min for first 15, 30min for next 15, 15min for rest
        tiers = [60, 30, 15]
        batch_size = 15

        for i in range(add_n):
            batch_idx = i // batch_size
            step = tiers[batch_idx] if batch_idx < len(tiers) else tiers[-1]

            # Try to find next available slot
            cand_minutes = add_step(cur_minutes, step)
            
            if cand_minutes is None:
                break
            
            # Skip if already used, try next slot
            attempts = 0
            while cand_minutes in used and attempts < 200:
                next_cand = add_step(cand_minutes, step)
                if next_cand is None:
                    break
                cand_minutes = next_cand
                attempts += 1

            if cand_minutes is None or cand_minutes in used:
                break

            cand_time, cand_next_day = self._from_minutes(cand_minutes)
            
            out.append((cand_time, cand_next_day))
            used.add(cand_minutes)
            cur_minutes = cand_minutes

        return out
    
    # ---- Delete policy: closest together, protect edges, iterative ----
    def _delete_policy(
        self,
        scenario_id,
        trips_with_times: list[tuple[Trips, time, bool]],
        delete_n: int,
        *,
        route_id=None,
        direction_id=None,
        service_id=None,
        shape_id=None,
    ):
        """
        Deletion policy with same-day service logic.
        trips_with_times: list of (Trip, departure_time, is_next_day)
        """
        if delete_n <= 0 or not trips_with_times:
            return []

        # Sort by extended time (same-day service logic)
        trips = sorted(trips_with_times, key=lambda x: self._to_minutes(x[1], x[2]))

        warnings = []
        if len(trips) <= 2:
            warnings.append({
                "route_id": route_id,
                "direction_id": direction_id,
                "service_id": service_id,
                "shape_id": shape_id,
                "reason": "Deletion not possible: total trips ≤ 2 (first/last are protected)."
            })
            return warnings

        def score_list(items):
            scores = []
            for i in range(1, len(items) - 1):
                prev_minutes = self._to_minutes(items[i - 1][1], items[i - 1][2])
                cur_minutes = self._to_minutes(items[i][1], items[i][2])
                next_minutes = self._to_minutes(items[i + 1][1], items[i + 1][2])

                gap_prev = abs(cur_minutes - prev_minutes)
                gap_next = abs(next_minutes - cur_minutes)
                score = gap_prev + gap_next
                scores.append((score, cur_minutes, i))
            scores.sort(key=lambda x: (x[0], x[1]))
            return scores

        to_delete_ids = []
        working = trips[:]
        k = delete_n

        while k > 0 and len(working) > 2:
            candidates = score_list(working)
            if not candidates:
                break
            _, _, idx = candidates[0]
            to_delete_ids.append(working[idx][0].trip_id)
            del working[idx]
            k -= 1

        if to_delete_ids:
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id__in=to_delete_ids).delete()
            Trips.objects.filter(scenario_id=scenario_id, trip_id__in=to_delete_ids).delete()

        actually_deleted = len(to_delete_ids)
        if actually_deleted < delete_n:
            warnings.append({
                "route_id": route_id,
                "direction_id": direction_id,
                "service_id": service_id,
                "shape_id": shape_id,
                "reason": f"Requested to delete {delete_n}, but only {actually_deleted} could be deleted (first/last are protected)."
            })

        return warnings

    # =========================
    # ========== POST =========
    # =========================
    @transactional
    def create(self, *, payload):
        data = payload or []
        
        if not data:
            return BaseResponse(
                message=ErrorMessages.EMPTY_PAYLOAD_EN, data=None, status_code=status.HTTP_400_BAD_REQUEST
            )
        scenario_id = data[0].get("scenario_id")
        if not scenario_id:
            return BaseResponse(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_FOR_TRIP_FREQUENCY_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        generated_trips = []
        warnings = []

        update_scenario_edit_state(scenario_id, "trips_data")
        for group in data:
            for route in group.get("routes", []):
                route_id = route.get("route_id")
                for pat in route.get("trips", []):
                    target_service = pat.get("service_id")
                    direction_id = pat.get("direction_id")
                    shape_id = pat.get("shape_id") or None
                    pattern_hash = pat.get("pattern_hash") or None
                    current_interval = int(pat.get("current_interval") or 0)
                    new_interval = int(pat.get("new_interval") or 0)
                    diff = new_interval - current_interval
                                 
                    if diff == 0:
                        continue

                    trips_this_pattern = self._get_route_direction_trips(
                        scenario_id, route_id, direction_id, target_service, shape_id, pattern_hash
                    )
                    existing_times = [(t, nd) for (_, t, nd) in trips_this_pattern]

                    # ------- ADD -------
                    if diff > 0:
                        if current_interval == 1:
                            
                            if existing_times:
                                base_time, base_next_day = existing_times[0]
                            else:
                                bounds = self._bounds_from_any_service(
                                    scenario_id, route_id, direction_id, prefer_shape_id=shape_id, pattern_hash=pattern_hash
                                )
                                if not bounds[0]:
                                    # ...
                                    continue
                                base_time, base_next_day = bounds[0], bounds[1]

                            base_minutes = self._to_minutes(base_time, base_next_day)

                            new_times = self._seq_interval1_variable_step_extended(
                                base_time, base_next_day, diff, existing_times
                            )

                            # Check if we got fewer times than requested (hit max limit)
                            if len(new_times) < diff:
                                warnings.append({
                                    "route_id": route_id,
                                    "direction_id": direction_id,
                                    "service_id": target_service,
                                    "shape_id": shape_id,
                                    "pattern_hash": pattern_hash,
                                    "reason": f"Requested {diff} new trips, but only {len(new_times)} could be created (max time limit: {self.MAX_EXTENDED_HOUR}:00)."
                                })

                            if trips_this_pattern:
                                template_trip, template_dep, template_next_day = trips_this_pattern[0]
                            else:
                                template_trip, template_dep, template_next_day = self._pick_template_trip(
                                    scenario_id,
                                    route_id,
                                    direction_id,
                                    exclude_service_id=target_service,
                                    prefer_shape_id=shape_id,
                                    pattern_hash=pattern_hash,
                                )
                                if not template_trip:
                                    warnings.append({
                                        "route_id": route_id,
                                        "direction_id": direction_id,
                                        "service_id": target_service,
                                        "shape_id": shape_id,
                                        "pattern_hash": pattern_hash,
                                        "reason": "Template trip not found (interval==1)."
                                    })
                                    continue

                            for dep_t, dep_next_day in new_times:
                                nt = self._clone_trip_shifted(
                                    scenario_id,
                                    template_trip,
                                    template_dep,
                                    template_next_day,
                                    dep_t,
                                    dep_next_day,
                                    target_service,
                                )
                                generated_trips.append(nt)
                                existing_times.append((dep_t, dep_next_day))

                        else:
                            if existing_times:
                                first_time, first_next_day = existing_times[0]
                                last_time, last_next_day = existing_times[-1]
                            else:
                                bounds = self._bounds_from_any_service(
                                    scenario_id, route_id, direction_id, prefer_shape_id=shape_id, pattern_hash=pattern_hash
                                )
                                if not bounds[0] or not bounds[2] or (bounds[0] == bounds[2] and bounds[1] == bounds[3]):
                                    warnings.append({
                                        "route_id": route_id,
                                        "direction_id": direction_id,
                                        "service_id": target_service,
                                        "shape_id": shape_id,
                                        "pattern_hash": pattern_hash,
                                        "reason": "No valid time range found for addition."
                                    })
                                    continue
                                first_time, first_next_day = bounds[0], bounds[1]
                                last_time, last_next_day = bounds[2], bounds[3]

                            first_minutes = self._to_minutes(first_time, first_next_day)
                            last_minutes = self._to_minutes(last_time, last_next_day)
                            ex_in_span = [
                                (t, nd) for t, nd in existing_times
                                if first_minutes <= self._to_minutes(t, nd) <= last_minutes
                            ]

                            new_times = self._choose_new_times_even_with_existing_extended(
                                first_time, first_next_day,
                                last_time, last_next_day,
                                ex_in_span, diff
                            )

                            if trips_this_pattern:
                                template_trip, template_dep, template_next_day = trips_this_pattern[0]
                            else:
                                template_trip, template_dep, template_next_day = self._pick_template_trip(
                                    scenario_id,
                                    route_id,
                                    direction_id,
                                    exclude_service_id=target_service,
                                    prefer_shape_id=shape_id,
                                    pattern_hash=pattern_hash,
                                )
                                if not template_trip:
                                    warnings.append({
                                        "route_id": route_id,
                                        "direction_id": direction_id,
                                        "service_id": target_service,
                                        "shape_id": shape_id,
                                        "pattern_hash": pattern_hash,
                                        "reason": "Template trip not found."
                                    })
                                    continue

                            for dep_t, dep_next_day in new_times:
                                nt = self._clone_trip_shifted(
                                    scenario_id,
                                    template_trip,
                                    template_dep,
                                    template_next_day,
                                    dep_t,
                                    dep_next_day,
                                    target_service,
                                )
                                generated_trips.append(nt)

                    # ------- DELETE -------
                    else:
                        del_n = abs(diff)
                        trips_this_pattern = self._get_route_direction_trips(
                            scenario_id, route_id, direction_id, target_service, shape_id, pattern_hash
                        )
                        w = self._delete_policy(
                            scenario_id,
                            trips_this_pattern,
                            del_n,
                            route_id=route_id,
                            direction_id=direction_id,
                            service_id=target_service,
                            shape_id=shape_id,
                        )
                        if w:
                            warnings.extend(w)

        payload = {"generated_trips": TripSerializer(generated_trips, many=True).data}
        if warnings:
            payload["warnings"] = warnings

        return BaseResponse(
            data=payload,
            message="運行頻度の更新が正常に完了しました。",
            status_code=status.HTTP_200_OK,
        )

    # ---------- small helper ----------
    def _model_to_dict_all_fields(self, obj):
        data = {}
        for field in obj._meta.fields:
            value = getattr(obj, field.name)
            if isinstance(field, models.ForeignKey):
                data[field.name] = value.id if value else None
            else:
                data[field.name] = value
        return data

    # ---------- bounds helper ----------
    def _bounds_from_any_service(
        self, scenario_id, route_id, direction_id, prefer_shape_id=None, pattern_hash=None
    ):
        """
        Get time bounds from any service using same-day service logic.
        Returns (first_time, first_next_day, last_time, last_next_day) or (None, None, None, None).
        """
        def get_times_from_query(q):
            trips_list = list(q)
            
            # Filter by pattern_hash if provided
            if pattern_hash:
                trip_ids = [t.trip_id for t in trips_list]
                trip_pattern_hashes = self._bulk_compute_pattern_hashes(scenario_id, trip_ids)
                trips_list = [t for t in trips_list if trip_pattern_hashes.get(t.trip_id) == pattern_hash]
            
            times = []
            for t in trips_list:
                dep_time, is_next_day = self._first_departure(scenario_id, t.trip_id)
                if dep_time is not None:
                    times.append((dep_time, is_next_day))
            return times

        if prefer_shape_id:
            q = Trips.objects.filter(
                scenario_id=scenario_id, route_id=route_id,
                direction_id=direction_id, shape_id=prefer_shape_id
            )
            times = get_times_from_query(q)
            if times:
                times.sort(key=lambda x: self._to_minutes(x[0], x[1]))
                return (times[0][0], times[0][1], times[-1][0], times[-1][1])

        q = Trips.objects.filter(
            scenario_id=scenario_id, route_id=route_id, direction_id=direction_id
        )
        times = get_times_from_query(q)
        if times:
            times.sort(key=lambda x: self._to_minutes(x[0], x[1]))
            return (times[0][0], times[0][1], times[-1][0], times[-1][1])

        return (None, None, None, None)


class _TripDetailProcessor:
    """
    GET: Return trip details (departure_time, route_id, service_id, trip_headsign)
    Params: scenario_id, route_id, service_id, direction_id, shape_id, pattern_hash
    """

    # Same constants for consistency
    EXTENDED_CUTOFF_HOUR = 4

    def _to_minutes_for_sort(self, t: time, is_next_day: bool = False) -> int:
        """
        Convert time to minutes for sorting using same-day service logic.
        Times 00:00-03:59 are always treated as 24:00-27:59.
        """
        minutes = t.hour * 60 + t.minute
        if t.hour < self.EXTENDED_CUTOFF_HOUR:
            minutes += 1440
        return minutes

    def _compute_trip_pattern_hash(self, scenario_id, trip_id) -> str | None:
        """
        Compute pattern_hash for a single trip based on its stop sequence.
        Returns the hash string or None if no stop_times found.
        """
        stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id, 
                trip_id=trip_id
            ).order_by("stop_sequence").values_list("stop_id", flat=True)
        )
        if not stop_times:
            return None
        stop_ids = [str(sid) for sid in stop_times]
        return RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)

    def _bulk_compute_pattern_hashes(self, scenario_id, trip_ids: list) -> dict:
        """
        Bulk compute pattern_hash for multiple trips.
        Returns dict: {trip_id: pattern_hash}
        """
        if not trip_ids:
            return {}
        
        # Get all stop_times for these trips in one query
        stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id__in=trip_ids
            ).order_by("trip_id", "stop_sequence").values("trip_id", "stop_id")
        )
        
        # Group by trip_id
        trip_stop_ids = defaultdict(list)
        for st in stop_times:
            trip_stop_ids[st["trip_id"]].append(str(st["stop_id"]))
        
        # Compute hash for each trip
        result = {}
        for trip_id, stop_ids in trip_stop_ids.items():
            if stop_ids:
                result[trip_id] = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)
            else:
                result[trip_id] = None
        
        return result

    def list(self, *, params):
        scenario_id = params.get("scenario_id")
        route_id = params.get("route_id")
        service_id = params.get("service_id")
        trip_headsign = params.get("trip_headsign")
        shape_id = params.get("shape_id")
        direction_id = params.get("direction_id")
        pattern_hash = params.get("pattern_hash")  # Added pattern_hash

        if not scenario_id or not route_id or not service_id:
            return Response(
                {"error": "scenario_id, route_id, and service_id are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        trips_qs = Trips.objects.filter(
            scenario_id=scenario_id,
            route_id=route_id,
            service_id=service_id,
        )
        
        # Filter by direction_id (can be 0, 1, or None)
        if direction_id is not None:
            if direction_id == "null" or direction_id == "":
                trips_qs = trips_qs.filter(direction_id__isnull=True)
            else:
                trips_qs = trips_qs.filter(direction_id=int(direction_id))
        
        if trip_headsign:
            trips_qs = trips_qs.filter(trip_headsign=trip_headsign)
        if shape_id:
            trips_qs = trips_qs.filter(shape_id=shape_id)

        # Convert to list for pattern_hash filtering
        trips_list = list(trips_qs)
        trip_ids = [t.trip_id for t in trips_list]

        # Filter by pattern_hash if provided
        if pattern_hash:
            trip_pattern_hashes = self._bulk_compute_pattern_hashes(scenario_id, trip_ids)
            trips_list = [t for t in trips_list if trip_pattern_hashes.get(t.trip_id) == pattern_hash]
            trip_ids = [t.trip_id for t in trips_list]

        stop_times_qs = StopTimes.objects.filter(
            scenario_id=scenario_id,
            trip_id__in=trip_ids,
            stop_sequence=1
        ).values("trip_id", "departure_time", "is_departure_time_next_day")

        trip_id_to_departure = {
            st["trip_id"]: (st["departure_time"], st.get("is_departure_time_next_day", False))
            for st in stop_times_qs
        }

        result = []
        for trip in trips_list:
            dep_info = trip_id_to_departure.get(trip.trip_id, (None, False))
            dep_time, is_next_day = dep_info
            result.append({
                "departure_time": dep_time,
                "is_departure_time_next_day": is_next_day,
                "trip_id": trip.trip_id,
                "route_id": trip.route_id,
                "service_id": trip.service_id,
                "direction_id": trip.direction_id,
                "trip_headsign": trip.trip_headsign,
                "shape_id": trip.shape_id
            })

        def sort_key(x):
            if x["departure_time"] is None:
                return (x["service_id"], 9999)
            # Use same-day service logic for sorting
            minutes = self._to_minutes_for_sort(
                x["departure_time"], 
                x.get("is_departure_time_next_day", False)
            )
            return (x["service_id"], minutes)

        result.sort(key=sort_key)

        return Response(result, status=status.HTTP_200_OK)

    def coordinates(self, *, params):
        shape_id = params.get("shape_id")
        scenario_id = params.get("scenario_id")
        if not shape_id:
            return Response(
                {"error": "shape_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        shapes_qs = Shape.objects.filter(shape_id=shape_id, scenario_id=scenario_id).order_by("shape_pt_sequence")
        coords = [
            {
                "lat": s.shape_pt_lat,
                "lon": s.shape_pt_lon,
                "sequence": s.shape_pt_sequence
            }
            for s in shapes_qs
        ]

        trips_qs = Trips.objects.filter(shape_id=shape_id)
        if scenario_id:
            trips_qs = trips_qs.filter(scenario_id=scenario_id)
        trip_ids = list(trips_qs.values_list("trip_id", flat=True))

        stops_geojson = {"type": "FeatureCollection", "features": []}
        if trip_ids:
            stop_times_qs = StopTimes.objects.filter(trip_id__in=trip_ids)
            if scenario_id:
                stop_times_qs = stop_times_qs.filter(scenario_id=scenario_id)

            stop_ids = stop_times_qs.values_list("stop_id", flat=True).distinct()

            stops_qs = Stops.objects.filter(stop_id__in=stop_ids)
            if scenario_id:
                stops_qs = stops_qs.filter(scenario_id=scenario_id)

            features = []
            for stop in stops_qs:
                geometry = {
                    "type": "Point",
                    "coordinates": [stop.stop_lon, stop.stop_lat],
                }
                properties = {
                    "stop_id": stop.stop_id,
                    "stop_name": stop.stop_name,
                    "stop_code": stop.stop_code,
                }
                features.append(
                    {
                        "type": "Feature",
                        "geometry": geometry,
                        "properties": properties,
                    }
                )

            stops_geojson["features"] = features

        return Response(
            {
                "shape_id": shape_id,
                "coordinates": coords,
                "stops_geojson": stops_geojson,
            },
            status=status.HTTP_200_OK,
        )


@log_service_call
class TripFrequencyService:
    @staticmethod
    def retrieve(*, scenario_id):
        return _TripFrequencyProcessor().retrieve(scenario_id=scenario_id)

    @staticmethod
    def create(*, payload):
        return _TripFrequencyProcessor().create(payload=payload)


@log_service_call
class TripDetailService:
    @staticmethod
    def list(*, params):
        return _TripDetailProcessor().list(params=params)

    @staticmethod
    def coordinates(*, params):
        return _TripDetailProcessor().coordinates(params=params)
