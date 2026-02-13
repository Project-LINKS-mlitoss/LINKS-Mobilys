# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import requests
import environ
from rest_framework import status as http_status
from visualization.constants import (
    OTP_DEFAULT_URL,
    OTP_ROUTER_DEFAULT_URL,
    OTP_DEFAULT_GRAPHS_BUCKET,
    OTP_BUILD_GRAPH_TIMEOUT_SECONDS,
    OTP_DELETE_GRAPH_TIMEOUT_SECONDS,
    OTP_ISOCHRONE_PATH_TEMPLATE,
    OTP_BUILD_GRAPH_PATH,
    OTP_DELETE_GRAPH_PATH,
    OTP_PBF_FILES_PATH,
    OTP_PBF_EXISTS_PATH,
)
import logging
from mobilys_BE.shared.log_json import log_json
from visualization.constants.messages import Messages
from visualization.services.base import log_service_call, ServiceError

env = environ.Env()
OTP_URL = env('OTP_URL', default=OTP_DEFAULT_URL)
OTP_ROUTER_URL = env('OTP_ROUTER_URL', default=OTP_ROUTER_DEFAULT_URL)
OTP_GRAPHS_BUCKET = env('OTP_GRAPHS_BUCKET', default=OTP_DEFAULT_GRAPHS_BUCKET)


logger = logging.getLogger(__name__)

def _graph_id(scenario_id: str, graph_type: str) -> str:
    # currently only one router per scenario, so use the scenario ID as the router ID
    return scenario_id


def _normalize_graph_type(graph_type: str | None) -> str:
    return (graph_type or "osm").strip().lower()

@log_service_call
def calculate_isochrone_fp005(
    origin_lat, origin_lon, max_time, walking_speed, mode,
    date, start_time, scenario_id, max_walking_distance=1000, graph_type="osm"
):
    gid = _graph_id(scenario_id, graph_type)
    otp_url = f"{OTP_ROUTER_URL}{OTP_ISOCHRONE_PATH_TEMPLATE.format(graph_id=gid)}"

    # Generate cutoffSec list: from 10 minutes up to max_time, in 10-minute steps
    step_sec = 10 * 60
    max_sec = max_time * 60
    cutoffSec = list(range(step_sec, max_sec + step_sec, step_sec))
    if cutoffSec[-1] > max_sec:
        cutoffSec[-1] = max_sec

    # Convert walking speed from km/h → m/s
    walk_speed_mps = walking_speed / 3.6

    params = {
        "fromPlace": f"{origin_lat},{origin_lon}",
        "mode": mode,
        "cutoffSec": cutoffSec,
        "date": date,
        "time": start_time,
        "format": "geojson",
        "maxWalkDistance": max_walking_distance,
        "walkSpeed": walk_speed_mps
    }

    response = requests.get(otp_url, params=params)
    if response.ok:
        return response.json()
    else:
        log_json(
            logger,
            logging.ERROR,
            "otp_isochrone_api_error",
            scenario_id=str(scenario_id),
            status_code=response.status_code,
            response_text=response.text
        )
        raise Exception("OTP isochrone calculation failed")


@log_service_call
def call_build_graph_api(scenario_id, prefecture, gtfs_zip, graph_type):

    otp_api_url = f"{OTP_URL}{OTP_BUILD_GRAPH_PATH}"
    normalized_graph_type = _normalize_graph_type(graph_type)

    # Reset stream position to start if needed
    gtfs_zip.seek(0)
    
    data = {
        'scenario_id': scenario_id,
        'prefecture': prefecture,
        'graph_type': normalized_graph_type
    }
    
    files = {
        'gtfs_file': ("gtfs.zip", gtfs_zip, 'application/zip')
    }

    try:
        response = requests.post(
            otp_api_url,
            files=files,
            data=data,
            timeout=OTP_BUILD_GRAPH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    except requests.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else None
        detail = e.response.text if e.response is not None else str(e)
        log_json(
            logger,
            logging.ERROR,
            "otp_build_graph_api_error",
            scenario_id=str(scenario_id),
            error=detail,
            status_code=status_code,
        )
        if status_code == http_status.HTTP_404_NOT_FOUND:
            raise ServiceError(
                Messages.OTP_PBF_FILE_NOT_FOUND_EN.format(prefecture=prefecture, graph_type=normalized_graph_type),
                error=detail,
                status_code=http_status.HTTP_404_NOT_FOUND,
            )
        raise ServiceError(
            Messages.OTP_BUILD_GRAPH_FAILED_EN,
            error=detail,
            status_code=http_status.HTTP_502_BAD_GATEWAY,
        )
    except requests.RequestException as e:
        log_json(
            logger,
            logging.ERROR,
            "otp_build_graph_api_error",
            scenario_id=str(scenario_id),
            error=str(e),
        )
        raise ServiceError(
            Messages.OTP_BUILD_GRAPH_FAILED_EN,
            error=str(e),
            status_code=http_status.HTTP_502_BAD_GATEWAY,
        )

    
@log_service_call
def call_delete_scenario_api(scenario_id):
    otp_api_url = f"{OTP_URL}{OTP_DELETE_GRAPH_PATH}"

    data = {
        'scenario_id': scenario_id,
    }
  
    try:
        response = requests.post(
            otp_api_url,
            data=data,
            timeout=OTP_DELETE_GRAPH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    except requests.RequestException as e:
        log_json(
            logger,
            logging.ERROR,
            "otp_delete_scenario_api_error",
            scenario_id=str(scenario_id),
            error=str(e)
        )
        return {'status': 'error', 'message': str(e)}




@log_service_call
def check_prefecture_pbf_exists(prefecture: str, graph_type: str = "osm") -> dict:
    normalized_graph_type = _normalize_graph_type(graph_type)
    otp_api_url = f"{OTP_URL}{OTP_PBF_EXISTS_PATH}"
    try:
        response = requests.get(
            otp_api_url,
            params={
                "prefecture": prefecture,
                "graph_type": normalized_graph_type,
            },
            timeout=OTP_BUILD_GRAPH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "success":
            raise ServiceError(
                Messages.FAILED_TO_FETCH_OTP_PBF_AVAILABILITY_EN,
                error=payload,
                status_code=http_status.HTTP_502_BAD_GATEWAY,
            )
        return payload
    except requests.RequestException as e:
        log_json(
            logger,
            logging.ERROR,
            "otp_pbf_exists_error",
            prefecture=prefecture,
            graph_type=normalized_graph_type,
            error=str(e),
        )
        raise ServiceError(
            Messages.FAILED_TO_FETCH_OTP_PBF_AVAILABILITY_EN,
            error=str(e),
            status_code=http_status.HTTP_502_BAD_GATEWAY,
        )
