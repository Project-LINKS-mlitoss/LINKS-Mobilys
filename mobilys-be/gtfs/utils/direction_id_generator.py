# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import math
from collections import defaultdict

from django.db import transaction
from typing import Dict, List, Optional, Tuple
from ..models import  Stops,  Trips, StopTimes,  RouteKeywordMap
import numpy as np

class DirectionIDGenerator:
    def __init__(self, scenario_id: str):
        self.scenario_id = scenario_id

    @staticmethod
    def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate bearing in degrees between two lat/lon points."""
        lat1, lat2 = math.radians(lat1), math.radians(lat2)
        d_lon = math.radians(lon2 - lon1)
        y = math.sin(d_lon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lon)
        return (math.degrees(math.atan2(y, x)) + 360) % 360

    # Private method to save direction IDs for trips
    def _save_direction_ids(self, trips, direction_assignment):
            update_objs = []
            for trip in trips:
                new_dir = direction_assignment.get(trip.trip_id)
                if new_dir is not None:
                    trip.direction_id = new_dir
                    trip.is_direction_id_generated = True
                    update_objs.append(trip)

            if update_objs:
                try:
                    with transaction.atomic():
                        Trips.objects.bulk_update(update_objs, ['direction_id', 'is_direction_id_generated'])
                except Exception as e:
                    raise Exception(f"Error updating direction IDs: {e}")

    def generate_direction_id(self):
        trips = list(Trips.objects.filter(scenario_id=self.scenario_id).all())
        trips_to_update = [trip for trip in trips if trip.direction_id == -1 or trip.direction_id is None]
        trip_ids = [trip.trip_id for trip in trips_to_update]

        mapping = RouteKeywordMap.objects.filter(scenario_id=self.scenario_id)
        route_to_keyword = {}
        for m in mapping:
            route_to_keyword[m.route_id] = m.keyword
            
        keyword_trips = defaultdict(list)
        for trip in trips:
            keyword = route_to_keyword.get(trip.route_id, None)
            trip.matched_keyword = keyword
            if keyword:
                keyword_trips[keyword].append(trip.trip_id)

        stop_times = StopTimes.objects.filter(trip_id__in=trip_ids)\
            .order_by('trip_id', 'stop_sequence')\
            .all()
        stop_ids = set(st.stop_id for st in stop_times)
        stops = Stops.objects.filter(stop_id__in=stop_ids)
        stop_id_to_coord = {s.stop_id: (s.stop_lat, s.stop_lon) for s in stops}

        trip_stops = defaultdict(list)
        for st in stop_times:
            latlon = stop_id_to_coord.get(st.stop_id)
            if latlon:
                trip_stops[st.trip_id].append((st.stop_sequence, latlon[0], latlon[1]))

        trip_bearings = {}
        for trip in trips:
            stops = sorted(trip_stops[trip.trip_id], key=lambda x: x[0])
            if len(stops) < 2:
                continue
            start = stops[0][1:3]
            end = stops[-1][1:3]
            if None in start + end:
                continue
            bearing = self.calculate_bearing(start[0], start[1], end[0], end[1])
            trip_bearings[trip.trip_id] = bearing

        direction_assignment = {}
        for keyword, tids in keyword_trips.items():
            bearings = [trip_bearings[tid] for tid in tids if tid in trip_bearings]
            if not bearings:
                continue
            median_bearing = np.median(bearings)
            for tid in tids:
                bearing = trip_bearings.get(tid)
                if bearing is None:
                    continue
                angle_diff = abs(bearing - median_bearing)
                angle_diff = 360 - angle_diff if angle_diff > 180 else angle_diff
                direction_id = 0 if angle_diff < 90 else 1
                direction_assignment[tid] = direction_id

        self._save_direction_ids(trips, direction_assignment)