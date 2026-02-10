import threading
from gtfs.models import Scenario, Notification
from django.db import transaction
from .services.otp_service import call_delete_scenario_api

import logging
from mobilys_BE.shared.log_json import log_json
from visualization.services.base import log_service_call
from visualization.constants.messages import Messages

logger = logging.getLogger(__name__)


@log_service_call
def delete_router_task(scenario_id: str):
    try:
        result = call_delete_scenario_api(scenario_id)
        status = result.get("status")
    except Exception as exc:
        log_json(
            logger,
            logging.ERROR,
            "delete_router_task_exception",
            scenario_id=str(scenario_id),
            error=str(exc),
        )
        return

    if status == "success":
        with transaction.atomic():
            Notification.objects.filter(scenario_id=scenario_id, description="success").exclude(notification_path="").update(
                notification_path="",             
                screen_menu="snackbar",            
                error_response={
                    "message": Messages.TASK_SCENARIO_DELETED_JA
                },
            )

            Scenario.objects.filter(id=scenario_id).delete()
    else:
        log_json(
            logger,
            logging.ERROR,
            "delete_router_task_failed",
            scenario_id=str(scenario_id),
            status=status,
        )
