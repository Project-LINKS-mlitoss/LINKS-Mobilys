import logging

from geopy.distance import geodesic
from django.db import connection

from visualization.constants import (
    DEFAULT_MAX_TRANSFERS,
    DEFAULT_MAX_WALK_DISTANCE_M,
    WALKING_SPEED_KMH_TO_MPS,
)
from gtfs.models import Stops, StopTimes

from mobilys_BE.shared.log_json import log_json
from visualization.services.base import log_service_call

from visualization.services.buffer_analysis.isochrone_service import (
    process_feature_per_radius,
    process_feature_per_radius_graph,
)
from visualization.services.buffer_analysis.geo_service import (
    get_route_and_stops_on_buffer_area,
    get_stops_on_buffer_area_multi_polygon,
)
from visualization.services.buffer_analysis.poi_service import (
    get_POI_on_buffer_area_with_MLIT,
    get_POI_graph_on_buffer_area_MLIT,
    get_poi_from_db_buffer,
)
from visualization.services.buffer_analysis.population_service import (
    get_population_within_buffer,
)


def get_stops_within_radius(scenario_id, lat, lon, radius):
    """
    Get all stops within a radius using geodesic distance.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - lat (str|float): Latitude.
    - lon (str|float): Longitude.
    - radius (str|float): Search radius in meters.

    Returns:
    - list[dict]: Stops within radius with distance info.
    """
    lat = float(lat)
    lon = float(lon)
    radius = float(radius)

    stops = Stops.objects.filter(scenario_id=scenario_id)
    stops_within_radius = []
    for stop in stops:
        distance = geodesic((lat, lon), (stop.stop_lat, stop.stop_lon)).meters
        if distance <= radius:
            stops_within_radius.append({
                "stop_id": stop.stop_id,
                "stop_name": stop.stop_name,
                "stop_lat": stop.stop_lat,
                "stop_lon": stop.stop_lon,
                "distance": distance
            })

    return stops_within_radius


def get_stops_within_radius_with_query(
    scenario_id,
    lat,
    lon,
    radius,
    departure_time,
    walking_speed_mps,
):
    """
    Query stops within radius using PostGIS distance and arrival time.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - lat (str|float): Latitude.
    - lon (str|float): Longitude.
    - radius (str|float): Search radius in meters.
    - departure_time (str): Departure time (HH:MM or HH:MM:SS).
    - walking_speed_mps (float): Walking speed in meters/sec.

    Returns:
    - list[dict]: Stops with distances and arrival time.
    """
    sql = """
    SELECT
      id as stop_uuid,
      stop_id,
      stop_name,
      stop_lat,
      stop_lon,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
      ) AS distance_m,
      %s::timestamp
        + (
            ST_Distance(
              ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            )
            / %s
          ) * interval '1 second'
        AS stop_arrival_time
    FROM
      stops
    WHERE
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
        ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)::geography,
        %s
      )
      AND scenario_id = %s
    ORDER BY
      distance_m;
    """
    params = [
        float(lon), float(lat),
        departure_time,
        float(lon), float(lat),
        float(walking_speed_mps),
        float(lon), float(lat),
        float(radius),
        scenario_id,
    ]
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        columns = [col[0] for col in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return results


def build_buffer_analysis_payload(
    scenario_id,
    lat,
    lon,
    departure_date,
    departure_time,
    walking_speed_kmh,
    max_travel_time,
    max_transfers=DEFAULT_MAX_TRANSFERS,
    max_walk_distance=DEFAULT_MAX_WALK_DISTANCE_M,
):
    """
    Build payload for buffer analysis endpoint.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - lat (str|float): Latitude.
    - lon (str|float): Longitude.
    - departure_date (str|date): Departure date (YYYY-MM-DD).
    - departure_time (str): Departure time.
    - walking_speed_kmh (str|float): Walking speed in km/h.
    - max_travel_time (str|float): Max travel time in minutes.
    - max_transfers (int): RAPTOR rounds.
    - max_walk_distance (int): Max walk distance in meters.

    Returns:
    - dict: Buffer analysis payload.
    """
    walking_speed_mps = float(walking_speed_kmh) / WALKING_SPEED_KMH_TO_MPS

    stops_original = Stops.objects.filter(scenario_id=scenario_id)
    stop_times_original = StopTimes.objects.filter(scenario_id=scenario_id)

    result_feature = process_feature_per_radius(
        stops_original,
        stop_times_original,
        scenario_id,
        lat,
        lon,
        departure_date,
        departure_time,
        walking_speed_mps,
        max_travel_time,
        max_transfers,
        max_walk_distance,
    )

    geojson = {
        "type": "FeatureCollection",
        "features": [result_feature],
    }

    data_graph_population_on_buffer_area = get_population_within_buffer(geojson, max_travel_time)

    tree_stats = result_feature.get("properties", {}).get("tree_stats", {})

    return {
        "buffer": geojson,
        "population": data_graph_population_on_buffer_area,
        "coverage_stats": {
            "algorithm": tree_stats.get("algorithm", "RAPTOR-hybrid"),
            "rounds_completed": tree_stats.get("rounds_completed", 0),
            "max_walk_distance": max_walk_distance,
            "walking_transfers_used": tree_stats.get("walking_transfers", 0),
            "total_sequences": tree_stats.get("total_sequences", 0),
            "transfer_stops": tree_stats.get("transfer_stops", 0),
            "explored_stops": tree_stats.get("explored_stops", 0),
            "processing_time_seconds": tree_stats.get("elapsed_seconds", 0),
        },
    }


@log_service_call
def build_buffer_analysis_graph_payload(
    scenario_id,
    lat,
    lon,
    departure_date,
    departure_time,
    walking_speed_kmh,
    max_travel_time,
    user_id,
    project_id=None,
    logger=None,
    max_transfers=DEFAULT_MAX_TRANSFERS,
    max_walk_distance=DEFAULT_MAX_WALK_DISTANCE_M,
):
    """
    Build payload for buffer analysis graph endpoint.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - lat (str|float): Latitude.
    - lon (str|float): Longitude.
    - departure_date (str|date): Departure date (YYYY-MM-DD).
    - departure_time (str): Departure time.
    - walking_speed_kmh (str|float): Walking speed in km/h.
    - max_travel_time (str|float): Max travel time in minutes.
    - user_id (int): User id.
    - project_id (str|None): Project id.
    - logger (Logger|None): Logger for MLIT errors.
    - max_transfers (int): RAPTOR rounds.
    - max_walk_distance (int): Max walk distance in meters.

    Returns:
    - dict: Buffer analysis graph payload.
    """
    walking_speed_mps = float(walking_speed_kmh) / WALKING_SPEED_KMH_TO_MPS

    geojson = process_feature_per_radius_graph(
        scenario_id,
        lat,
        lon,
        departure_date,
        departure_time,
        walking_speed_mps,
        max_travel_time,
        max_transfers,
        max_walk_distance,
    )

    data_graph_route_and_stops_on_buffer_area = get_route_and_stops_on_buffer_area(geojson)
    data_graph_stops_on_buffer_area = get_stops_on_buffer_area_multi_polygon(geojson)

    try:
        mlit_pois_fc = get_POI_on_buffer_area_with_MLIT(geojson)
        data_POI_on_buffer_area = get_POI_graph_on_buffer_area_MLIT(mlit_pois_fc)
    except Exception as e:
        if logger:
            log_json(
                logger,
                logging.WARNING,
                "mlit_poi_fetch_failed",
                error=str(e),
                scenario_id=str(scenario_id) if scenario_id is not None else None,
                project_id=str(project_id) if project_id is not None else None,
            )
        data_POI_on_buffer_area = []
    data_POI_on_buffer_area = get_poi_from_db_buffer(
        data_POI_on_buffer_area, geojson, user_id, project_id=project_id, poi_batch_id=None
    )

    poly_only = {
        "type": "FeatureCollection",
        "features": [
            f for f in geojson.get("features", [])
            if f.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon")
        ]
    }

    data_graph_population_on_buffer_area = get_population_within_buffer(poly_only, max_travel_time)

    tree_stats = {}
    for feature in geojson.get("features", []):
        if feature.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon"):
            tree_stats = feature.get("properties", {}).get("tree_stats", {})
            break

    return {
        "route_and_stops": data_graph_route_and_stops_on_buffer_area,
        "stops_on_buffer_area": data_graph_stops_on_buffer_area,
        "POI_on_buffer_area": data_POI_on_buffer_area,
        "population": data_graph_population_on_buffer_area,
        "coverage_stats": {
            "algorithm": tree_stats.get("algorithm", "RAPTOR-hybrid"),
            "rounds_completed": tree_stats.get("rounds_completed", 0),
            "max_walk_distance": max_walk_distance,
            "walking_transfers_used": tree_stats.get("walking_transfers", 0),
            "total_sequences": tree_stats.get("total_sequences", 0),
            "transfer_stops": tree_stats.get("transfer_stops", 0),
            "explored_stops": tree_stats.get("explored_stops", 0),
            "processing_time_seconds": tree_stats.get("elapsed_seconds", 0),
        },
    }
