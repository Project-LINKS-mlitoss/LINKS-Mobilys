# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging

from gtfs.models import Scenario
from mobilys_BE.shared.log_json import log_json
from visualization.constants.values import (
    DEFAULT_MAX_TRAVEL_TIME_MIN,
    DEFAULT_WALKING_SPEED_KMH,
    MEDICAL_INSTITUTION_DATASET_ID,
    SCHOOL_DATASET_ID,
)
from visualization.models import PoiBatch
from visualization.services.otp_service import calculate_isochrone_fp005
from visualization.services.poi_service import (
    POIs_within_isochrone,
    get_active_poi_batch_id,
    get_user_point_of_interest_based_on_road_network_analysis,
)
from visualization.services.road_network_reachability.road_network_analysis_service import (
    get_population_within_isochrone,
    get_stop_groups_within_isochrone,
)
from visualization.utils.share_util import normalize_project_id as _normalize_project_id
from visualization.services.base import ServiceError, log_service_call
from visualization.constants.messages import Messages

logger = logging.getLogger(__name__)


def build_isochrone_payload(data: dict) -> dict:
    """
    Calculate OTP isochrone for a given origin and request settings.

    Parameters:
    - data (dict): Request payload with origin, time, and scenario settings.

    Returns:
    - dict: Isochrone GeoJSON payload.
    """
    try:
        origin_lat = float(data["origin_lat"])
        origin_lon = float(data["origin_lon"])
        max_time = int(data.get("max_travel_time", DEFAULT_MAX_TRAVEL_TIME_MIN))
        walking_speed_kmh = float(data.get("walking_speed", DEFAULT_WALKING_SPEED_KMH))
        date = data["date"]
        start_time = data["start_time"]
        mode = data.get("mode", "WALK,TRANSIT")
        max_walking_distance = data.get("max_walking_distance")
        scenario_id = str(data.get("scenario_id"))
        graph_type = data.get("graph_type", "").lower()

        isochrone_polygon = calculate_isochrone_fp005(
            origin_lat,
            origin_lon,
            max_time,
            walking_speed_kmh,
            mode,
            date,
            start_time,
            scenario_id,
            max_walking_distance,
            graph_type,
        )
    except Exception as exc:
        raise ServiceError(Messages.FAILED_TO_COMPUTE_ISOCHRONE_EN, error=str(exc), status_code=500) from exc

    return {"isochrone": isochrone_polygon}


@log_service_call
def build_analysis_payload(data: dict, user) -> dict:
    """
    Analyze an isochrone and return POIs, population, and stop group stats.

    Parameters:
    - data (dict): Request payload including isochrone and scenario_id.
    - user (object): Request user for custom POIs.

    Returns:
    - dict: Analysis payload.
    """
    try:
        isochrone_polygon = data.get("isochrone") or data.get("isochrone_geojson")
        project_id = _normalize_project_id(data.get("project_id"))
        active_batch_id = get_active_poi_batch_id(project_id) if project_id else None
        user_batch_id = None
        if not project_id and user is not None:
            active = (
                PoiBatch.objects.filter(
                    user_id=getattr(user, "id", None),
                    project_id__isnull=True,
                    is_active=True,
                )
                .order_by("-created_at")
                .first()
            )
            user_batch_id = str(active.id) if active else None
        effective_batch_id = active_batch_id or user_batch_id
        suppress_mlit = bool(effective_batch_id)

        population_results = get_population_within_isochrone(isochrone_polygon)
        scenario_id = str(data.get("scenario_id"))
        stop_groups = get_stop_groups_within_isochrone(scenario_id, isochrone_polygon)
        schools = []
        medical_institutions = []
        custom_poi = []
        if suppress_mlit:
            try:
                custom_poi = get_user_point_of_interest_based_on_road_network_analysis(
                    isochrone_polygon,
                    user_id=getattr(user, "id", None),
                    project_id=project_id,
                    poi_batch_id=effective_batch_id,
                )
            except Exception as exc:
                log_json(
                    logger,
                    logging.WARNING,
                    "custom_poi_fetch_failed",
                    error=str(exc),
                    project_id=str(project_id) if project_id is not None else None,
                    poi_batch_id=str(active_batch_id) if active_batch_id is not None else None,
                )
        else:
            try:
                schools = POIs_within_isochrone(isochrone_polygon, SCHOOL_DATASET_ID)
            except Exception as exc:
                log_json(
                    logger,
                    logging.WARNING,
                    "mlit_poi_fetch_failed",
                    dataset_id=SCHOOL_DATASET_ID,
                    error=str(exc),
                )
                schools = []
            try:
                medical_institutions = POIs_within_isochrone(isochrone_polygon, MEDICAL_INSTITUTION_DATASET_ID)
            except Exception as exc:
                log_json(
                    logger,
                    logging.WARNING,
                    "mlit_poi_fetch_failed",
                    dataset_id=MEDICAL_INSTITUTION_DATASET_ID,
                    error=str(exc),
                )
                medical_institutions = []

    except ServiceError:
        raise
    except Exception as exc:
        raise ServiceError(Messages.FAILED_TO_ANALYZE_ISOCHRONE_EN, error=str(exc), status_code=500) from exc

    return {
        "isochrone": isochrone_polygon,
        "schools_within_isochrone": schools,
        "medical_institutions_within_isochrone": medical_institutions,
        "custom_poi": custom_poi,
        "population_within_isochrone": population_results,
        "stop_groups": stop_groups,
    }


def is_isochrone_empty(isochrone_polygon: dict | None) -> bool:
    features = (isochrone_polygon or {}).get("features") or []
    if not features:
        return True
    return all(not f.get("geometry") for f in features)
