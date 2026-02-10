from collections import defaultdict
from datetime import datetime, timedelta
import time

import numpy as np
from geopy.distance import geodesic
from scipy.spatial import cKDTree

from visualization.constants import (
    DEFAULT_TRANSFER_BUFFER_SECONDS,
    METERS_PER_DEGREE_APPROX,
)


class OptimizedTransferNetwork:
    """KD-Tree based transfer network - O(n log n) instead of O(n^2)."""

    def __init__(self):
        self.network = {}
        self.kdtree = None

    def build(self, stops, walking_speed_mps, max_walk_distance=500):
        stops_list = list(stops)
        if not stops_list:
            self.network = defaultdict(list)
            return

        coords = np.array([[s.stop_lat, s.stop_lon] for s in stops_list])

        self.kdtree = cKDTree(coords)
        max_dist_deg = max_walk_distance / METERS_PER_DEGREE_APPROX

        self.network = defaultdict(list)

        for i, stop in enumerate(stops_list):
            indices = self.kdtree.query_ball_point([stop.stop_lat, stop.stop_lon], max_dist_deg)

            for j in indices:
                if i == j:
                    continue
                target = stops_list[j]
                distance = geodesic((stop.stop_lat, stop.stop_lon), (target.stop_lat, target.stop_lon)).meters

                if distance <= max_walk_distance:
                    self.network[stop.stop_id].append({
                        "to_stop": target.stop_id,
                        "distance": distance,
                        "walk_time": distance / walking_speed_mps
                    })

    def get_transfers_from(self, stop_id):
        return self.network.get(stop_id, [])


_TRANSFER_NETWORK_CACHE = {}


def get_or_build_transfer_network(scenario_id, stops, walking_speed_mps, max_walk_distance=500):
    """
    Get cached transfer network or build a new one.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - stops (Iterable[Stops]): Stops queryset.
    - walking_speed_mps (float): Walking speed in meters/sec.
    - max_walk_distance (int): Max walk distance in meters.

    Returns:
    - OptimizedTransferNetwork: Cached transfer network.
    """
    cache_key = f"{scenario_id}_{walking_speed_mps}_{max_walk_distance}"
    if cache_key not in _TRANSFER_NETWORK_CACHE:
        network = OptimizedTransferNetwork()
        network.build(stops, walking_speed_mps, max_walk_distance)
        _TRANSFER_NETWORK_CACHE[cache_key] = network
    return _TRANSFER_NETWORK_CACHE[cache_key]


class OptimizedStopTimesLookup:
    """Pre-indexed stop times for O(1) lookups."""

    def __init__(self, stop_times_qs):
        self.by_stop = defaultdict(list)
        self.by_trip = defaultdict(list)

        for st in stop_times_qs:
            self.by_stop[st.stop_id].append(st)
            self.by_trip[st.trip_id].append(st)

        for trip_id in self.by_trip:
            self.by_trip[trip_id].sort(key=lambda x: x.stop_sequence)

    def get_by_trip(self, trip_id):
        return self.by_trip.get(trip_id, [])

    def find_transfers(self, stop_id, min_time, valid_trips, limit=None):
        """Find available transfers at a stop after min_time."""
        candidates = self.by_stop.get(stop_id, [])
        results = []
        for st in candidates:
            if st.trip_id not in valid_trips:
                continue
            if st.departure_time is None or st.departure_time < min_time:
                continue
            results.append(st)
            if limit and len(results) >= limit:
                break
        return results


class RaptorStopState:
    """Multi-state tracking for Pareto optimal solutions."""

    __slots__ = ["states"]

    def __init__(self):
        self.states = []

    def add_if_non_dominated(self, arrival_time, transfer_count, trip_id=None, stop_sequence=None):
        for arr, trans, _ in self.states:
            if arr <= arrival_time and trans <= transfer_count:
                return False

        self.states = [
            (arr, trans, info)
            for arr, trans, info in self.states
            if not (arrival_time <= arr and transfer_count <= trans)
        ]

        info = {"trip_id": trip_id, "stop_sequence": stop_sequence} if trip_id else None
        self.states.append((arrival_time, transfer_count, info))
        return True

    def get_best_time(self):
        if not self.states:
            return float("inf")
        return min(arr for arr, _, _ in self.states)

    def get_all_states(self):
        return self.states


def find_transfers_raptor(
    initial_sequences,
    stop_times_lookup,
    valid_trips,
    max_time_seconds,
    transfer_network,
    max_rounds=2,
):
    """
    RAPTOR-inspired algorithm for comprehensive transit routing.
    Returns (all_sequences, transfer_stops, stats).
    """
    start_time = time.time()

    stop_states = defaultdict(RaptorStopState)

    marked_stops_current = set()
    for init in initial_sequences:
        stop_id = init["stop_id"]
        time_to_stop = init.get("time_to_stop", 0)

        if stop_states[stop_id].add_if_non_dominated(time_to_stop, 0):
            marked_stops_current.add(stop_id)

    all_sequences = []
    transfer_stops = set()
    walking_transfers = 0
    total_stops_explored = len(marked_stops_current)

    for round_k in range(max_rounds + 1):
        if not marked_stops_current:
            break

        marked_stops_next = set()
        round_sequences = []

        boardable_trips = defaultdict(list)

        for stop_id in marked_stops_current:
            best_arrival = stop_states[stop_id].get_best_time()

            if best_arrival >= max_time_seconds:
                continue

            min_departure_time = datetime.combine(
                datetime.today(),
                datetime.min.time()
            ) + timedelta(seconds=best_arrival + DEFAULT_TRANSFER_BUFFER_SECONDS)

            candidates = stop_times_lookup.find_transfers(
                stop_id,
                min_departure_time.time(),
                valid_trips,
                limit=None
            )

            for st in candidates:
                boardable_trips[st.trip_id].append({
                    "board_stop_id": stop_id,
                    "board_arrival": best_arrival,
                    "board_stop_time": st
                })

        for trip_id, boarding_options in boardable_trips.items():
            trip_stops = stop_times_lookup.get_by_trip(trip_id)

            if not trip_stops:
                continue

            best_board = min(boarding_options, key=lambda x: x["board_arrival"])
            board_stop_seq = best_board["board_stop_time"].stop_sequence
            board_departure = best_board["board_stop_time"].departure_time

            for st in trip_stops:
                if st.stop_sequence < board_stop_seq:
                    continue

                ride_time = calculate_ride_time(board_departure, st.arrival_time)
                total_time = best_board["board_arrival"] + ride_time

                if total_time >= max_time_seconds:
                    continue

                if stop_states[st.stop_id].add_if_non_dominated(
                    total_time, round_k, trip_id, st.stop_sequence
                ):
                    marked_stops_next.add(st.stop_id)

                    if round_k > 0:
                        transfer_stops.add(st.stop_id)

                    round_sequences.append({
                        "trip_id": trip_id,
                        "stop_id": st.stop_id,
                        "stop_sequence": st.stop_sequence,
                        "transfer_count": round_k,
                        "accumulated_seconds": int(total_time)
                    })

        if round_k < max_rounds:
            for stop_id in marked_stops_next.copy():
                best_arrival = stop_states[stop_id].get_best_time()

                if best_arrival >= max_time_seconds:
                    continue

                nearby_stops = transfer_network.get_transfers_from(stop_id)

                for walk in nearby_stops:
                    target_stop = walk["to_stop"]
                    walk_arrival = best_arrival + walk["walk_time"]

                    if walk_arrival >= max_time_seconds:
                        continue

                    if stop_states[target_stop].add_if_non_dominated(
                        walk_arrival, round_k
                    ):
                        marked_stops_next.add(target_stop)
                        walking_transfers += 1

        all_sequences.extend(round_sequences)
        total_stops_explored += len(marked_stops_next)

        if not marked_stops_next or round_k >= max_rounds:
            break

        marked_stops_current = marked_stops_next

    elapsed = time.time() - start_time

    stats = {
        "total_sequences": len(all_sequences),
        "transfer_stops": len(transfer_stops),
        "walking_transfers": walking_transfers,
        "explored_stops": total_stops_explored,
        "elapsed_seconds": elapsed,
        "algorithm": "RAPTOR-hybrid",
        "rounds_completed": round_k + 1,
    }

    return all_sequences, transfer_stops, stats


def calculate_ride_time(from_time, to_time):
    """Calculate ride time between two time points."""
    try:
        if isinstance(from_time, str):
            from_time = datetime.strptime(from_time, "%H:%M:%S").time()
        if isinstance(to_time, str):
            to_time = datetime.strptime(to_time, "%H:%M:%S").time()
        from_dt = datetime.combine(datetime.today(), from_time)
        to_dt = datetime.combine(datetime.today(), to_time)
        if to_dt < from_dt:
            to_dt += timedelta(days=1)
        return (to_dt - from_dt).total_seconds()
    except Exception:
        return 0


def calculate_wait_time(arrival_time, departure_time):
    """Calculate waiting time between arrival and departure."""
    try:
        if isinstance(arrival_time, str):
            arrival_time = datetime.strptime(arrival_time, "%H:%M:%S").time()
        if isinstance(departure_time, str):
            departure_time = datetime.strptime(departure_time, "%H:%M:%S").time()
        arr_dt = datetime.combine(datetime.today(), arrival_time)
        dep_dt = datetime.combine(datetime.today(), departure_time)
        if dep_dt < arr_dt:
            dep_dt += timedelta(days=1)
        return (dep_dt - arr_dt).total_seconds()
    except Exception:
        return DEFAULT_TRANSFER_BUFFER_SECONDS
