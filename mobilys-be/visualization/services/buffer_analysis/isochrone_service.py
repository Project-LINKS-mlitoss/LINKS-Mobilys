# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from datetime import datetime, timedelta
import math
import time

from geopy.distance import geodesic
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

from visualization.constants import (
    DATE_FORMAT,
    TIME_FORMAT,
    DEFAULT_MAX_TRANSFERS,
    DEFAULT_MAX_WALK_DISTANCE_M,
    DEFAULT_CIRCLE_POINTS,
    METERS_PER_DEGREE_LAT,
    METERS_PER_DEGREE_LON,
    RADIUS_HEATMAP_FILL_COLOR,
    RADIUS_HEATMAP_STROKE_COLOR,
    RADIUS_HEATMAP_FILL_OPACITY,
)
from gtfs.models import Calendar, CalendarDates, Trips, Stops, StopTimes

from visualization.services.buffer_analysis.raptor import (
    OptimizedStopTimesLookup,
    get_or_build_transfer_network,
    find_transfers_raptor,
)


def process_feature_per_radius(
    stops_original,
    stop_times_original,
    scenario_id,
    lat,
    lon,
    departure_date,
    departure_time,
    walking_speed,
    max_travel_time,
    max_transfers=DEFAULT_MAX_TRANSFERS,
    max_walk_distance=DEFAULT_MAX_WALK_DISTANCE_M,
):
    """
    Process buffer analysis using RAPTOR hybrid algorithm.

    Parameters:
    - stops_original (Iterable[Stops]): Stops queryset.
    - stop_times_original (Iterable[StopTimes]): StopTimes queryset.
    - scenario_id (str): Scenario identifier.
    - lat (str|float): Latitude.
    - lon (str|float): Longitude.
    - departure_date (str|date): Departure date.
    - departure_time (str): Departure time.
    - walking_speed (str|float): Walking speed (m/s).
    - max_travel_time (str|float): Max travel time in minutes.
    - max_transfers (int): RAPTOR rounds (0, 1, 2...).
    - max_walk_distance (int): Max walk distance in meters.

    Returns:
    - dict: GeoJSON Feature for merged buffer area.
    """
    overall_start = time.time()

    # Get valid service IDs for the departure date
    current_available_service_ids = []
    if departure_date:
        dep_date_obj = (
            datetime.strptime(departure_date, DATE_FORMAT).date()
            if isinstance(departure_date, str)
            else departure_date
        )
        weekday = dep_date_obj.strftime("%A").lower()
        calendar_qs = Calendar.objects.filter(
            scenario_id=scenario_id,
            start_date__lte=dep_date_obj,
            end_date__gte=dep_date_obj,
            **{weekday: 1},
        )
        service_ids_calendar = set(calendar_qs.values_list("service_id", flat=True))
        calendar_dates_qs = CalendarDates.objects.filter(
            scenario_id=scenario_id, date=dep_date_obj
        )
        added = set(
            calendar_dates_qs.filter(exception_type=1).values_list("service_id", flat=True)
        )
        removed = set(
            calendar_dates_qs.filter(exception_type=2).values_list("service_id", flat=True)
        )
        current_available_service_ids = (service_ids_calendar | added) - removed

    valid_trips = set(
        Trips.objects.filter(
            scenario_id=scenario_id, service_id__in=current_available_service_ids
        ).values_list("trip_id", flat=True)
    )

    lat = float(lat)
    lon = float(lon)
    walking_speed = float(walking_speed)
    max_travel_time = float(max_travel_time)

    max_travel_time_seconds = max_travel_time * 60
    radius = walking_speed * (max_travel_time * 60)

    transfer_network = get_or_build_transfer_network(
        scenario_id, stops_original, walking_speed, max_walk_distance
    )
    stop_times_lookup = OptimizedStopTimesLookup(stop_times_original)

    stops_properties = []
    for stop in stops_original:
        try:
            distance = geodesic((lat, lon), (stop.stop_lat, stop.stop_lon)).meters
            if distance <= radius:
                stops_properties.append({
                    "stop_id": stop.stop_id,
                    "distance": distance,
                    "time_to_stop": distance / walking_speed
                })
        except Exception:
            continue

    trip_id_stop_id_sequence = []
    if departure_time:
        fmt = TIME_FORMAT if len(str(departure_time).split(":")) == 3 else "%H:%M"
        dep_time_obj = datetime.strptime(departure_time, fmt)

        for stop in stops_properties:
            stop_arrival_time = (dep_time_obj + timedelta(seconds=stop["time_to_stop"])).time()
            candidates = stop_times_lookup.find_transfers(
                stop["stop_id"], stop_arrival_time, valid_trips
            )

            for st in candidates:
                trip_id_stop_id_sequence.append({
                    "trip_id": st.trip_id,
                    "stop_id": stop["stop_id"],
                    "stop_sequence": st.stop_sequence,
                    "arrival_time": st.arrival_time.strftime("%H:%M:%S") if st.arrival_time else None,
                    "time_to_stop": stop["time_to_stop"],
                })

    all_sequences, transfer_stops, tree_stats = find_transfers_raptor(
        trip_id_stop_id_sequence,
        stop_times_lookup,
        valid_trips,
        max_travel_time_seconds,
        transfer_network,
        max_rounds=max_transfers,
    )

    accumulated_map = {}
    for seq in all_sequences:
        key = (seq["trip_id"], seq["stop_id"], seq["stop_sequence"])
        acc_time = seq.get("accumulated_seconds", 0)

        if key not in accumulated_map or acc_time < accumulated_map[key]:
            accumulated_map[key] = acc_time

    unique_trips = list(set([seq["trip_id"] for seq in all_sequences]))

    polyline_features = []
    all_stoptimes_props = []

    for trip_id in unique_trips:
        stop_times = stop_times_lookup.get_by_trip(trip_id)
        if not stop_times:
            continue

        polyline_coords = []
        stoptimes_props = []

        for st in stop_times:
            stop_obj = next((s for s in stops_original if s.stop_id == st.stop_id), None)
            if not stop_obj:
                continue

            polyline_coords.append([stop_obj.stop_lon, stop_obj.stop_lat])

            try:
                arrival_time_str = st.arrival_time.strftime("%H:%M:%S")
                departure_time_str = st.departure_time.strftime("%H:%M:%S")

                key = (st.trip_id, st.stop_id, st.stop_sequence)
                accumulated_seconds = accumulated_map.get(key, None)

                if accumulated_seconds is not None:
                    left_time = max(0, int(max_travel_time_seconds - accumulated_seconds))
                else:
                    left_time = 0

                stoptimes_props.append({
                    "stop_id": st.stop_id,
                    "stop_name": stop_obj.stop_name,
                    "stop_lat": float(stop_obj.stop_lat),
                    "stop_lon": float(stop_obj.stop_lon),
                    "arrival_time": arrival_time_str,
                    "departure_time": departure_time_str,
                    "stop_sequence": st.stop_sequence,
                    "left_time": left_time,
                    "accumulated_seconds": accumulated_seconds,
                })
            except Exception:
                continue

        if len(polyline_coords) >= 2:
            polyline_features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": polyline_coords},
                "properties": {"type": "trip_polyline", "trip_id": trip_id, "stoptimes": stoptimes_props},
            })
            all_stoptimes_props.extend(stoptimes_props)

    def make_circle(lon, lat, radius, num_points=DEFAULT_CIRCLE_POINTS):
        lon = float(lon)
        lat = float(lat)
        radius = float(radius)
        coords = []
        for i in range(num_points + 1):
            angle = 2 * math.pi * i / num_points
            dx, dy = radius * math.cos(angle), radius * math.sin(angle)
            delta_lon = dx / (METERS_PER_DEGREE_LON * math.cos(math.radians(lat)))
            delta_lat = dy / METERS_PER_DEGREE_LAT
            coords.append([lon + delta_lon, lat + delta_lat])
        return coords

    ring_features = [{
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [make_circle(lon, lat, radius)]},
        "properties": {
            "type": "radius_heatmap",
            "radius_from": 0,
            "radius_to": radius,
            "fillColor": RADIUS_HEATMAP_FILL_COLOR,
            "color": RADIUS_HEATMAP_STROKE_COLOR,
            "fillOpacity": RADIUS_HEATMAP_FILL_OPACITY,
        },
    }]

    stoptimes_polygon_features = []
    for st_props in all_stoptimes_props:
        if st_props.get("left_time", 0) > 0:
            buffer_radius = st_props["left_time"] * walking_speed
            stoptimes_polygon_features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        make_circle(st_props["stop_lon"], st_props["stop_lat"], buffer_radius)
                    ],
                },
                "properties": {
                    "type": "stoptime_buffer",
                    "stop_id": st_props["stop_id"],
                    "stop_name": st_props["stop_name"],
                    "left_time": st_props["left_time"],
                    "buffer_radius": buffer_radius,
                },
            })

    features = ring_features + stoptimes_polygon_features
    geoms = [shape(f["geometry"]) for f in features if f["geometry"]["type"] == "Polygon"]
    merged_geoms = unary_union(geoms)

    overall_elapsed = time.time() - overall_start

    return {
        "type": "Feature",
        "properties": {
            "radius": radius,
            "scenario_id": scenario_id,
            "lat": lat,
            "lon": lon,
            "departure_date": departure_date,
            "departure_time": departure_time,
            "walking_speed": walking_speed,
            "max_travel_time": max_travel_time,
            "tree_stats": tree_stats,
            "processing_time_seconds": overall_elapsed,
        },
        "geometry": mapping(merged_geoms),
    }


def process_feature_per_radius_graph(
    scenario_id,
    lat,
    lon,
    departure_date,
    departure_time,
    walking_speed,
    max_travel_time,
    max_transfers=DEFAULT_MAX_TRANSFERS,
    max_walk_distance=DEFAULT_MAX_WALK_DISTANCE_M,
):
    """
    Process buffer analysis for graph API using RAPTOR.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - lat (str|float): Latitude.
    - lon (str|float): Longitude.
    - departure_date (str|date): Departure date.
    - departure_time (str): Departure time.
    - walking_speed (str|float): Walking speed (m/s).
    - max_travel_time (str|float): Max travel time in minutes.
    - max_transfers (int): RAPTOR rounds.
    - max_walk_distance (int): Max walk distance in meters.

    Returns:
    - dict: FeatureCollection with buffer.
    """
    result = process_feature_per_radius(
        Stops.objects.filter(scenario_id=scenario_id),
        StopTimes.objects.filter(scenario_id=scenario_id),
        scenario_id,
        lat,
        lon,
        departure_date,
        departure_time,
        walking_speed,
        max_travel_time,
        max_transfers,
        max_walk_distance,
    )
    return {"type": "FeatureCollection", "features": [result], "properties": result["properties"]}
