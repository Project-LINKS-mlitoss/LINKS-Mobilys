from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Optional

from django.db import IntegrityError
from rest_framework import status

from gtfs.constants import ErrorMessages
from gtfs.models import Agency, Calendar, Routes, Shape, StopTimes, Stops, Trips
from gtfs.services.base import log_service_call, transactional
from gtfs.utils.route_data_utils import RouteDataUtils
from gtfs.utils.scenario_utils import update_scenario_edit_state
from gtfs.utils.translation_utils import upsert_translations
from mobilys_BE.shared.log_json import log_json

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RoutePatternsServiceError(Exception):
    message: str
    error: Any
    status_code: int
    data: Optional[dict[str, Any]] = None


def _compute_trip_pattern_metadata(trips, stop_times_qs):
    trip_stop_ids = defaultdict(list)
    for row in stop_times_qs.order_by("trip_id", "stop_sequence").values("trip_id", "stop_id"):
        trip_stop_ids[row["trip_id"]].append(str(row["stop_id"]))

    counts = defaultdict(int)
    headsigns = {}
    for trip in trips:
        stop_ids = trip_stop_ids.get(trip.trip_id)
        if not stop_ids:
            continue
        pattern_hash = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids)
        key = (trip.route_id, trip.direction_id, trip.service_id, pattern_hash)
        counts[key] += 1
        if key not in headsigns:
            headsigns[key] = trip.trip_headsign or ""
    return counts, headsigns


@log_service_call
class RoutePatternsService:
    @staticmethod
    def retrieve(*, scenario_id: Optional[str]) -> dict[str, Any]:
        if not scenario_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_DOT,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_DOT,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        trips = Trips.objects.filter(scenario_id=scenario_id)
        routes = Routes.objects.filter(scenario_id=scenario_id)
        stops = Stops.objects.filter(scenario_id=scenario_id)
        shapes = Shape.objects.filter(scenario_id=scenario_id)
        agencies = Agency.objects.filter(scenario_id=scenario_id)
        stop_times = StopTimes.objects.filter(scenario_id=scenario_id)

        trip_service_ids = list(trips.values_list("service_id", flat=True).distinct())
        calendar_service_ids = list(
            Calendar.objects.filter(scenario_id=scenario_id).values_list("service_id", flat=True).distinct()
        )

        service_ids = list(trip_service_ids)
        seen = set(trip_service_ids)
        for sid in calendar_service_ids:
            if sid not in seen:
                service_ids.append(sid)
                seen.add(sid)

        stops_data = [
            {"id": s.stop_id, "name": s.stop_name, "latlng": [float(s.stop_lat), float(s.stop_lon)]} for s in stops
        ]

        route_patterns = RouteDataUtils.get_route_pattern(routes, trips, stop_times, stops, shapes)

        pattern_counts, headsigns = _compute_trip_pattern_metadata(trips, stop_times)
        for route in route_patterns:
            for pattern in route.get("patterns", []):
                stop_ids = [str(sid) for sid in pattern.get("stop_ids", [])]
                pattern_hash = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids) if stop_ids else None
                key = (route["route_id"], pattern.get("direction_id"), pattern.get("service_id"), pattern_hash)
                pattern["interval"] = pattern_counts.get(key, 0)
                pattern["pattern_hash"] = pattern_hash
                if "trip_headsign" not in pattern or not pattern.get("trip_headsign"):
                    pattern["trip_headsign"] = headsigns.get(key, "")

        return {
            "agency_ids": list(agencies.values_list("agency_id", flat=True).distinct()),
            "service_ids": service_ids,
            "stops": stops_data,
            "routes": route_patterns,
        }

    @staticmethod
    @transactional
    def create_new_route_pattern(
        *,
        scenario_id: Optional[str],
        route_data: Any,
        trip_data: Any,
        stop_sequence: Any,
        translations: Any,
    ) -> dict[str, Any]:
        if not all([scenario_id, route_data, trip_data, stop_sequence]):
            raise RoutePatternsServiceError(
                message=ErrorMessages.ROUTE_DATA_REQUIRED_JA,
                error=ErrorMessages.ROUTE_DATA_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(route_data, dict) or not isinstance(trip_data, dict):
            raise RoutePatternsServiceError(
                message=ErrorMessages.ROUTE_DATA_MUST_BE_DICT_JA,
                error=ErrorMessages.INVALID_DATA_FORMAT_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        route_id = route_data.get("route_id")
        agency_id = route_data.get("agency_id")
        route_type = route_data.get("route_type")
        direction_id = trip_data.get("direction_id")
        service_id = trip_data.get("service_id")

        if not route_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.ROUTE_ID_REQUIRED_JA,
                error=ErrorMessages.ROUTE_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            dup_check = RouteDataUtils.check_duplicate_route_id(scenario_id, route_id)
            if dup_check["exists"]:
                raise RoutePatternsServiceError(
                    message=dup_check["message"],
                    error="ルートIDが重複しています。",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            check = RouteDataUtils.check_duplicate_pattern(
                scenario_id,
                route_id,
                direction_id,
                service_id,
                stop_sequence,
                agency_id,
                route_type,
            )
            if check["exists"]:
                raise RoutePatternsServiceError(
                    message=check["message"],
                    error=ErrorMessages.ROUTE_PATTERN_DUPLICATE_JA,
                    status_code=status.HTTP_400_BAD_REQUEST,
                    data={"trip_id": check.get("trip_id"), "shape_id": check.get("shape_id")},
                )

            trip_id = RouteDataUtils.create_route_pattern(scenario_id, route_data, trip_data, stop_sequence)
            update_scenario_edit_state(scenario_id, "routes_data")

            if isinstance(translations, list) and translations:
                created_cnt, updated_cnt = upsert_translations(
                    scenario_id=scenario_id,
                    table_name="routes",
                    entity_ids={"route_id": route_id},
                    items=translations,
                )
            else:
                created_cnt, updated_cnt = 0, 0

            return {
                "trip_id": trip_id,
                "route_id": route_id,
                "translations_created": created_cnt,
                "translations_updated": updated_cnt,
            }

        except RoutePatternsServiceError:
            raise
        except IntegrityError as e:
            log_json(
                logger,
                logging.ERROR,
                "route_pattern_create_integrity_error",
                scenario_id=str(scenario_id),
                route_id=str(route_id),
                error=str(e),
            )
            raise RoutePatternsServiceError(
                message=ErrorMessages.DATA_INTEGRITY_ERROR_JA,
                error=ErrorMessages.ROUTE_PATTERN_CREATE_ERROR_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            ) from e
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_pattern_create_unexpected_error",
                scenario_id=str(scenario_id),
                route_id=str(route_id) if route_id else "unknown",
                error=str(e),
            )
            raise RoutePatternsServiceError(
                message=ErrorMessages.UNEXPECTED_ERROR_JA_DOT,
                error=ErrorMessages.ROUTE_PATTERN_CREATE_ERROR_JA,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

    @staticmethod
    @transactional
    def delete_route_patterns(*, scenario_id: Optional[str], route_patterns: Any) -> dict[str, Any]:
        if not scenario_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_VARIANT_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_VARIANT_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not route_patterns:
            raise RoutePatternsServiceError(
                message=ErrorMessages.ROUTE_PATTERN_REQUIRED_JA,
                error=ErrorMessages.ROUTE_PATTERN_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = RouteDataUtils.delete_route_pattern(scenario_id, route_patterns)

            deleted_route_ids = {rp["route_id"] for rp in route_patterns if isinstance(rp, dict) and "route_id" in rp}
            for route_id in deleted_route_ids:
                remaining_trips = Trips.objects.filter(scenario_id=scenario_id, route_id=route_id)
                if not remaining_trips.exists():
                    Routes.objects.filter(scenario_id=scenario_id, route_id=route_id).delete()

            update_scenario_edit_state(scenario_id, "routes_data")

            return {
                "deleted_trip_ids": result.get("deleted_trip_ids"),
                "message": result.get("message"),
                "error": result.get("error"),
            }
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_pattern_deletion_error",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutePatternsServiceError(
                message=str(e),
                error=ErrorMessages.ROUTE_PATTERN_DELETE_ERROR_JA,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

    @staticmethod
    @transactional
    def update_stop_sequence(
        *,
        scenario_id: Optional[str],
        route_id: Optional[str],
        direction_id: Any,
        service_id: Optional[str],
        shape_id: Optional[str],
        new_stop_sequence: Any,
    ) -> dict[str, Any]:
        if not scenario_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA_DOT,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA_DOT,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not route_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.ROUTE_ID_REQUIRED_MESSAGE_JA,
                error=ErrorMessages.ROUTE_ID_REQUIRED_MESSAGE_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if direction_id is None:
            raise RoutePatternsServiceError(
                message=ErrorMessages.DIRECTION_ID_REQUIRED_JA,
                error=ErrorMessages.DIRECTION_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not service_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.SERVICE_ID_REQUIRED_JA,
                error=ErrorMessages.SERVICE_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not shape_id:
            raise RoutePatternsServiceError(
                message=ErrorMessages.SHAPE_ID_REQUIRED_JA,
                error=ErrorMessages.SHAPE_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not new_stop_sequence or not isinstance(new_stop_sequence, list):
            raise RoutePatternsServiceError(
                message=ErrorMessages.INVALID_OR_MISSING_NEW_STOP_SEQUENCE_EN,
                error=ErrorMessages.INVALID_OR_MISSING_NEW_STOP_SEQUENCE_EN,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = RouteDataUtils.edit_route_pattern_stop_sequence(
                scenario_id=scenario_id,
                route_id=route_id,
                direction_id=direction_id,
                service_id=service_id,
                shape_id=shape_id,
                new_stop_sequence=new_stop_sequence,
            )
            update_scenario_edit_state(scenario_id, "routes_data")

            return {
                "edited_trip_ids": result["data"]["edited_trip_ids"],
                "stops_count": result["data"]["stops_count"],
                "new_shape_id": result["data"]["new_shape_id"],
                "message": result.get("message"),
                "error": result.get("error"),
            }
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "route_pattern_update_error",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutePatternsServiceError(
                message=str(e),
                error=ErrorMessages.ROUTE_PATTERN_UPDATE_ERROR_JA,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e

    @staticmethod
    @transactional
    def create_existing_route_pattern(
        *,
        scenario_id: Optional[str],
        route_id: Optional[str],
        trip_data: Any,
        stop_sequence: Any,
    ) -> dict[str, Any]:
        if not all([scenario_id, route_id, trip_data, stop_sequence]):
            raise RoutePatternsServiceError(
                message=ErrorMessages.ROUTE_EXISTING_PATTERN_REQUIRED_JA,
                error=ErrorMessages.ROUTE_EXISTING_PATTERN_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            direction_id = trip_data.get("direction_id") if isinstance(trip_data, dict) else None
            service_id = trip_data.get("service_id") if isinstance(trip_data, dict) else None

            route = Routes.objects.filter(scenario_id=scenario_id, route_id=route_id).first()
            if not route:
                raise RoutePatternsServiceError(
                    message=ErrorMessages.SPECIFIED_ROUTE_NOT_FOUND_JA,
                    error=ErrorMessages.SPECIFIED_ROUTE_NOT_FOUND_JA,
                    status_code=status.HTTP_404_NOT_FOUND,
                )

            check = RouteDataUtils.check_duplicate_pattern(
                scenario_id,
                route_id,
                direction_id,
                service_id,
                stop_sequence,
                route.agency_id,
                route.route_type,
            )

            if check["exists"]:
                raise RoutePatternsServiceError(
                    message=check["message"],
                    error=ErrorMessages.ROUTE_PATTERN_DUPLICATE_JA,
                    status_code=status.HTTP_400_BAD_REQUEST,
                    data={"trip_id": check.get("trip_id"), "shape_id": check.get("shape_id")},
                )

            result = RouteDataUtils.create_existing_route_pattern(scenario_id, route_id, trip_data, stop_sequence)
            update_scenario_edit_state(scenario_id, "routes_data")

            return result
        except RoutePatternsServiceError:
            raise
        except Exception as e:
            log_json(
                logger,
                logging.ERROR,
                "existing_route_pattern_unexpected_error",
                scenario_id=str(scenario_id),
                error=str(e),
            )
            raise RoutePatternsServiceError(
                message=ErrorMessages.UNEXPECTED_ERROR_JA_DOT,
                error=ErrorMessages.EXISTING_ROUTE_PATTERN_CREATE_ERROR_JA,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from e
