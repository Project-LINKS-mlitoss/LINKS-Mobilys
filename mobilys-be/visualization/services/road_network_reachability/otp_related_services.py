import logging

from django.shortcuts import get_object_or_404

from gtfs.models import Notification, Scenario
from gtfs.constants import GraphStatus
from gtfs.utils.scenario_utils import generate_gtfs_zip
from mobilys_BE.shared.log_json import log_json
from visualization.services.base import log_service_call, transactional, ServiceError
from visualization.constants.values import ALLOWED_DRM_PREFECTURES
from visualization.services.otp_service import (
    call_build_graph_api,
    check_prefecture_pbf_exists,
)
from visualization.utils.road_network_reachability_utils import (
    _normalize_graph_type,
    _status_field,
)
from visualization.constants.messages import Messages

logger = logging.getLogger(__name__)


@log_service_call
def build_graph_payload(scenario_id: str, graph_type: str, user) -> dict:
    """
    Build OTP graph for a scenario.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - graph_type (str): "osm" or "drm".
    - user: Request user for notifications.

    Returns:
    - dict: Payload with status message.
    """
    scenario = Scenario.objects.get(id=scenario_id)
    graph_type = _normalize_graph_type(graph_type)
    field = _status_field(graph_type)

    setattr(scenario, field, GraphStatus.BUILDING.value)
    scenario.save(update_fields=[field])

    raw = list(scenario.prefecture_info or [])
    pref_list = [str(p).strip() for p in raw if isinstance(p, str) and p.strip()]
    pref_list = list(dict.fromkeys(pref_list))

    if graph_type == "drm":
        pref_list = [p for p in pref_list if p.lower() in ALLOWED_DRM_PREFECTURES]

    if not pref_list:
        raise ServiceError(
            Messages.OTP_PREF_INFO_EMPTY_EN,
            status_code=400,
        )

    prefecture_csv = ",".join(pref_list)

    Notification.objects.create(
        user=user,
        message=Messages.OTP_GRAPH_BUILD_STARTED_TEMPLATE_EN.format(scenario_name=scenario.scenario_name),
        notification_path="",
        scenario_id=str(scenario.id),
        screen_menu="Road Network Analysis",
        is_read=False,
        description="message",
    )

    try:
        zip_buffer = generate_gtfs_zip(scenario_id)
        zip_buffer.seek(0)

        otp_response = call_build_graph_api(
            scenario_id=str(scenario.id),
            prefecture=prefecture_csv,
            gtfs_zip=zip_buffer,
            graph_type=graph_type,
        )

        if otp_response.get("status") != "success":
            setattr(scenario, field, GraphStatus.FAILED.value)
            scenario.save(update_fields=[field])
            raise ServiceError(
                Messages.OTP_BUILD_GRAPH_FAILED_EN,
                error=otp_response,
                status_code=500,
            )

        setattr(scenario, field, GraphStatus.BUILT.value)
        scenario.save(update_fields=[field])
        return {}
    except Exception as exc:
        log_json(
            logger,
            logging.ERROR,
            "otp_build_graph_exception",
            scenario_id=str(scenario.id),
            error=str(exc),
        )
        setattr(scenario, field, GraphStatus.FAILED.value)
        scenario.save(update_fields=[field])

        notification_data = {
            "message": Messages.OTP_GRAPH_BUILD_FAILED_TEMPLATE_EN.format(scenario_name=scenario.scenario_name),
            "notification_path": "",
            "scenario_id": str(scenario.id),
            "screen_menu": "Road Network Analysis",
            "is_read": False,
            "description": "error",
        }
        Notification.objects.create(user=user, **notification_data)
        raise


def build_prefecture_availability_payload(scenario_id: str, graph_type: str) -> dict:
    """
    Check OTP PBF availability for a scenario's prefectures by hitting the OTP service.

    Parameters:
    - scenario_id (str): Scenario identifier.
    - graph_type (str): "osm" or "drm".

    Returns:
    - dict: Availability payload.
    """
    scenario = Scenario.objects.get(id=scenario_id)

    raw = list(scenario.prefecture_info or [])
    wanted = [str(p).strip() for p in raw if isinstance(p, str) and p.strip()]

    normalized_graph_type = _normalize_graph_type(graph_type)
    available = []
    missing = []

    for prefecture in wanted:
        availability = check_prefecture_pbf_exists(prefecture, normalized_graph_type)
        if availability.get("available"):
            available.append(prefecture)
        else:
            missing.append(prefecture)

    return {
        "ok": len(missing) == 0,
        "needed": wanted,
        "available": available,
        "missing": missing,
        "graph_type": normalized_graph_type,
    }


