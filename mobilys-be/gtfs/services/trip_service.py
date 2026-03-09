# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import status

from gtfs.models import RouteKeywordMap, Routes, StopTimes, Stops, Trips
from gtfs.serializers.request.trip_request import TripUpsertRequestSerializer
from gtfs.serializers.response.stop_response import StopTimesSerializer
from gtfs.serializers.response.trip_response import TripModelSerializer
from gtfs.services.base import log_service_call, transactional
from gtfs.utils.scenario_utils import update_scenario_edit_state
from gtfs.utils.shape_generator import ShapeGenerator
from gtfs.utils.trip_data_utils import TripDataUtils
from gtfs.constants import ErrorMessages
from mobilys_BE.shared.response import BaseResponse


def _build_stop_name_map(*, scenario_id: str, stop_ids: list[str]) -> dict[str, str]:
    if not stop_ids:
        return {}
    stops = Stops.objects.filter(scenario_id=scenario_id, stop_id__in=stop_ids).only("stop_id", "stop_name")
    return {s.stop_id: s.stop_name for s in stops}


def _create_trip_with_stop_times(*, trip_data: dict, stop_times: list[dict]) -> Trips:
    # Find a reference trip with identical pattern to copy optional stop_time fields.
    reference_by_seq: dict[int, StopTimes] = {}
    if stop_times:
        stop_ids = [st["stop_id"] for st in stop_times]
        candidates = Trips.objects.filter(
            scenario_id=trip_data["scenario_id"],
            route_id=trip_data["route_id"],
            direction_id=trip_data.get("direction_id"),
            service_id=trip_data["service_id"],
        )
        for cand in candidates:
            ref_sts = list(
                StopTimes.objects.filter(
                    scenario=cand.scenario,
                    trip_id=cand.trip_id,
                ).order_by("stop_sequence")
            )
            if len(ref_sts) != len(stop_ids):
                continue
            if [r.stop_id for r in ref_sts] == stop_ids:
                reference_by_seq = {r.stop_sequence: r for r in ref_sts}
                break

    def fallback_ref(st_dict: dict, seq: int, field: str, default=None):
        if field in st_dict and st_dict[field] not in (None, ""):
            return st_dict[field]
        ref = reference_by_seq.get(seq)
        if ref:
            return getattr(ref, field)
        return default

    trip = Trips.objects.create(**trip_data)

    objs = [
        StopTimes(
            trip_id=trip.trip_id,
            scenario=trip.scenario,
            arrival_time=st["arrival_time"],
            departure_time=st["departure_time"],
            stop_id=st["stop_id"],
            stop_sequence=st["stop_sequence"],
            stop_headsign=fallback_ref(st, st["stop_sequence"], "stop_headsign", ""),
            pickup_type=fallback_ref(st, st["stop_sequence"], "pickup_type"),
            drop_off_type=fallback_ref(st, st["stop_sequence"], "drop_off_type"),
            shape_dist_traveled=st.get("shape_dist_traveled"),
            timepoint=fallback_ref(st, st["stop_sequence"], "timepoint"),
            is_arrival_time_next_day=st.get("is_arrival_time_next_day", False),
            is_departure_time_next_day=st.get("is_departure_time_next_day", False),
        )
        for st in stop_times
    ]
    StopTimes.objects.bulk_create(objs)

    # Generate shape
    ShapeGenerator.process_create_shapes_data_from_database_by_trips([trip], trip.scenario_id)

    return trip


def _update_trip_with_stop_times(*, instance: Trips, validated_data: dict) -> Trips:
    stop_times = validated_data.pop("stop_times", None)
    old_trip_id = instance.trip_id

    # Update trip fields (including potential rename of trip_id)
    for attr, val in validated_data.items():
        instance.is_direction_id_generated = False
        setattr(instance, attr, val)
    instance.save()

    new_trip_id = instance.trip_id

    if stop_times is not None:
        # Preserve any existing fields when not provided in payload
        existing_by_seq = {
            st.stop_sequence: st
            for st in StopTimes.objects.filter(
                scenario=instance.scenario,
                trip_id=old_trip_id,
            )
        }

        # When stop_times are provided, replace them entirely.
        # Delete using the old_trip_id to avoid leaving orphaned rows when trip_id changed.
        StopTimes.objects.filter(
            scenario=instance.scenario,
            trip_id=old_trip_id,
        ).delete()

        def fallback(st_dict: dict, field: str, existing: StopTimes | None, default=None):
            # Treat missing or blank as "keep existing"; only use provided non-blank values.
            if field in st_dict and st_dict[field] not in (None, ""):
                return st_dict[field]
            if existing:
                return getattr(existing, field)
            return default

        objs = [
            StopTimes(
                trip_id=new_trip_id,
                scenario=instance.scenario,
                arrival_time=st["arrival_time"],
                departure_time=st["departure_time"],
                stop_id=st["stop_id"],
                stop_sequence=st["stop_sequence"],
                stop_headsign=fallback(st, "stop_headsign", existing_by_seq.get(st["stop_sequence"]), ""),
                pickup_type=fallback(st, "pickup_type", existing_by_seq.get(st["stop_sequence"])),
                drop_off_type=fallback(st, "drop_off_type", existing_by_seq.get(st["stop_sequence"])),
                shape_dist_traveled=fallback(st, "shape_dist_traveled", existing_by_seq.get(st["stop_sequence"])),
                location_group_id=fallback(st, "location_group_id", existing_by_seq.get(st["stop_sequence"]), ""),
                location_id=fallback(st, "location_id", existing_by_seq.get(st["stop_sequence"]), ""),
                start_pickup_drop_off_window=fallback(
                    st, "start_pickup_drop_off_window", existing_by_seq.get(st["stop_sequence"])
                ),
                end_pickup_drop_off_window=fallback(
                    st, "end_pickup_drop_off_window", existing_by_seq.get(st["stop_sequence"])
                ),
                continuous_pickup=fallback(st, "continuous_pickup", existing_by_seq.get(st["stop_sequence"])),
                continuous_drop_off=fallback(st, "continuous_drop_off", existing_by_seq.get(st["stop_sequence"])),
                pickup_booking_rule_id=fallback(
                    st, "pickup_booking_rule_id", existing_by_seq.get(st["stop_sequence"]), ""
                ),
                drop_off_booking_rule_id=fallback(
                    st, "drop_off_booking_rule_id", existing_by_seq.get(st["stop_sequence"]), ""
                ),
                timepoint=fallback(st, "timepoint", existing_by_seq.get(st["stop_sequence"])),
                is_arrival_time_next_day=fallback(
                    st, "is_arrival_time_next_day", existing_by_seq.get(st["stop_sequence"]), False
                ),
                is_departure_time_next_day=fallback(
                    st, "is_departure_time_next_day", existing_by_seq.get(st["stop_sequence"]), False
                ),
            )
            for st in stop_times
        ]
        StopTimes.objects.bulk_create(objs)
    else:
        # If stop_times not provided but trip_id changed, migrate StopTimes to new trip_id
        if old_trip_id != new_trip_id:
            StopTimes.objects.filter(
                scenario=instance.scenario,
                trip_id=old_trip_id,
            ).update(trip_id=new_trip_id)

    # Reset shape_id to empty
    instance.shape_id = ""
    instance.save()
    ShapeGenerator.delete_shape_id_that_not_used_in_trip(instance.scenario_id)

    # Generate shape
    ShapeGenerator.process_create_shapes_data_from_database_by_trips([instance], instance.scenario_id)

    return instance


@log_service_call
class TripListCreateService:
    @staticmethod
    def get_queryset(*, scenario_id):
        return Trips.objects.filter(scenario_id=scenario_id)

    @staticmethod
    @transactional
    def create(*, payload):
        data = payload.copy() if hasattr(payload, "copy") else dict(payload)
        scenario_id = data.get("scenario_id")
        if not scenario_id:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        trip_id = data.get("trip_id")
        if not trip_id:
            return BaseResponse(
                data=None,
                message=ErrorMessages.TRIP_ID_REQUIRED_JA,
                error=ErrorMessages.TRIP_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if Trips.objects.filter(trip_id=trip_id, scenario_id=scenario_id).exists():
            return BaseResponse(
                data=None,
                message=ErrorMessages.TRIP_ID_ALREADY_EXISTS_TEMPLATE_JA.format(trip_id=trip_id),
                error=ErrorMessages.TRIP_ID_ALREADY_EXISTS_TEMPLATE_JA.format(trip_id=trip_id),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        route_id = data.get("route_id")
        if not route_id:
            return BaseResponse(
                data=None,
                message=ErrorMessages.ROUTE_ID_REQUIRED_FOR_TRIP_JA,
                error=ErrorMessages.ROUTE_ID_REQUIRED_FOR_TRIP_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not Routes.objects.filter(route_id=route_id, scenario_id=scenario_id).exists():
            return BaseResponse(
                data=None,
                message=ErrorMessages.ROUTE_ID_NOT_FOUND_TEMPLATE_JA.format(route_id=route_id),
                error=ErrorMessages.ROUTE_ID_NOT_FOUND_TEMPLATE_JA.format(route_id=route_id),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TripUpsertRequestSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        is_duplicate = TripDataUtils.check_create_duplicate_trip(dict(serializer.validated_data), scenario_id)
        if is_duplicate:
            return BaseResponse(
                data=None,
                message=ErrorMessages.DUPLICATE_TRIP_JA,
                error=ErrorMessages.DUPLICATE_TRIP_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        validated_data = dict(serializer.validated_data)
        stop_times = validated_data.pop("stop_times", [])
        trip = _create_trip_with_stop_times(trip_data=validated_data, stop_times=stop_times)
        update_scenario_edit_state(scenario_id, "trips_data")

        created_stop_times = list(
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id=trip.trip_id).order_by("stop_sequence")
        )
        trip._prefetched_stop_times = created_stop_times

        stop_ids = [st.stop_id for st in created_stop_times]
        stop_name_by_stop_id = _build_stop_name_map(scenario_id=str(trip.scenario_id), stop_ids=stop_ids)
        response_serializer = TripModelSerializer(trip, context={"stop_name_by_stop_id": stop_name_by_stop_id})

        return BaseResponse(
            data=response_serializer.data,
            message="運行が正常に作成されました。",
            error=None,
            status_code=status.HTTP_201_CREATED,
        )

    @staticmethod
    def list(*, scenario_id):
        if not scenario_id:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_REQUIRED_JA,
                error=ErrorMessages.SCENARIO_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        qs = Trips.objects.filter(scenario_id=scenario_id)
        if not qs.exists():
            return BaseResponse(
                data=None,
                message=ErrorMessages.TRIPS_NOT_FOUND_JA,
                error=ErrorMessages.TRIPS_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND,
            )

        all_trip_keys = {(trip.trip_id, trip.scenario_id) for trip in qs}
        all_stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id__in=[trip_id for trip_id, _ in all_trip_keys],
            ).order_by("trip_id", "stop_sequence")
        )
        all_stop_ids = {st.stop_id for st in all_stop_times}
        all_stops = list(Stops.objects.filter(scenario_id=scenario_id, stop_id__in=all_stop_ids))

        routes = Routes.objects.filter(scenario_id=scenario_id)
        if not routes.exists():
            return BaseResponse(
                data=None,
                message=ErrorMessages.ROUTE_NOT_FOUND_JA,
                error=ErrorMessages.ROUTE_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND,
            )

        data = TripDataUtils.build_route_patterns_structure(routes, qs, all_stop_times, all_stops)
        return BaseResponse(
            data=data,
            message="運行リストを読むことが完了しました",
            error=None,
            status_code=status.HTTP_200_OK,
        )


@log_service_call
class PreviewShapeCoordinatesService:
    @staticmethod
    def post(*, scenario_id, stop_ids):
        if not scenario_id or not stop_ids:
            return BaseResponse(
                error=ErrorMessages.SCENARIO_ID_AND_STOP_ID_REQUIRED_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
                message=ErrorMessages.SCENARIO_ID_AND_STOP_ID_REQUIRED_JA,
            )
        coords = ShapeGenerator.get_routed_coordinates_from_stops(scenario_id, stop_ids)
        return BaseResponse(
            data=coords,
            message="座標の取得が完了しました",
            error=None,
            status_code=status.HTTP_200_OK,
        )


@log_service_call
class TripEditService:
    @staticmethod
    def get(*, scenario_id, trip_id):
        if not scenario_id or not trip_id:
            return BaseResponse(
                error=ErrorMessages.SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
                message=ErrorMessages.SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA,
            )
        try:
            trip = Trips.objects.get(scenario_id=scenario_id, trip_id=trip_id)
        except Trips.DoesNotExist:
            return BaseResponse(
                error=ErrorMessages.TRIP_NOT_FOUND_JA,
                data=None,
                status_code=status.HTTP_404_NOT_FOUND,
                message=ErrorMessages.TRIP_NOT_FOUND_JA,
            )

        stop_times = list(
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id=trip.trip_id).order_by("stop_sequence")
        )
        trip._prefetched_stop_times = stop_times
        stop_ids = [st.stop_id for st in stop_times]
        stop_name_by_stop_id = _build_stop_name_map(scenario_id=str(scenario_id), stop_ids=stop_ids)

        response_data = {
            "trip": TripModelSerializer(trip, context={"stop_name_by_stop_id": stop_name_by_stop_id}).data,
            "stop_times": StopTimesSerializer(stop_times, many=True, context={"stop_name_by_stop_id": stop_name_by_stop_id}).data,
        }
        return BaseResponse(
            data=response_data,
            message="トリップ詳細のリクエスト完了しました",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    @transactional
    def put(*, scenario_id, trip_id, payload):
        if not scenario_id or not trip_id:
            return BaseResponse(
                error=ErrorMessages.SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
                message=ErrorMessages.SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA,
            )

        trip_data = payload.get("data", {})
        old_id = trip_data.get("old_trip_id")
        try:
            trip = Trips.objects.get(scenario_id=scenario_id, trip_id=old_id)
        except Trips.DoesNotExist:
            return BaseResponse(
                error=ErrorMessages.TRIP_NOT_FOUND_JA,
                data=None,
                status_code=status.HTTP_404_NOT_FOUND,
                message=ErrorMessages.TRIP_NOT_FOUND_JA,
            )

        is_duplicate = TripDataUtils.check_duplicate_trip(trip_data, scenario_id=scenario_id, trip_id=old_id)
        is_id_conflict = Trips.objects.filter(scenario_id=scenario_id, trip_id=trip_id).exists()
        if is_duplicate or (is_id_conflict and trip_id != old_id):
            return BaseResponse(
                data=None,
                message=ErrorMessages.DUPLICATE_TRIP_JA,
                error=ErrorMessages.DUPLICATE_TRIP_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        update_scenario_edit_state(scenario_id, "trips_data")
        trip_data["trip_id"] = trip_id
        serializer = TripUpsertRequestSerializer(data=trip_data, partial=True)
        if not serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.TRIP_UPDATE_FAILED_JA,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        validated_data = dict(serializer.validated_data)
        validated_data.pop("scenario_id", None)
        validated_data.pop("route_id", None)
        updated = _update_trip_with_stop_times(instance=trip, validated_data=validated_data)
        stop_times = list(
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id=updated.trip_id).order_by("stop_sequence")
        )
        updated._prefetched_stop_times = stop_times
        stop_ids = [st.stop_id for st in stop_times]
        stop_name_by_stop_id = _build_stop_name_map(scenario_id=str(scenario_id), stop_ids=stop_ids)
        response_serializer = TripModelSerializer(updated, context={"stop_name_by_stop_id": stop_name_by_stop_id})

        return BaseResponse(
            data=response_serializer.data,
            message="トリップの更新が完了しました",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    @transactional
    def patch(*, scenario_id, trip_id, payload):
        if not scenario_id or not trip_id:
            return BaseResponse(
                error=ErrorMessages.SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
                message=ErrorMessages.SCENARIO_ID_AND_TRIP_ID_REQUIRED_JA,
            )

        try:
            trip = Trips.objects.get(scenario_id=scenario_id, trip_id=trip_id)
        except Trips.DoesNotExist:
            return BaseResponse(
                error=ErrorMessages.TRIP_NOT_FOUND_JA,
                data=None,
                status_code=status.HTTP_404_NOT_FOUND,
                message=ErrorMessages.TRIP_NOT_FOUND_JA,
            )

        trip_data = payload.get("data", {})
        new_trip_id = trip_data.get("trip_id", trip_id)

        if new_trip_id != trip_id:
            is_id_conflict = Trips.objects.filter(scenario_id=scenario_id, trip_id=new_trip_id).exists()
            if is_id_conflict:
                return BaseResponse(
                    data=None,
                    message=f"trip_id「{new_trip_id}」は既に存在します。",
                    error=f"trip_id「{new_trip_id}」は既に存在します。",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        if trip_data:
            is_duplicate = TripDataUtils.check_duplicate_trip(trip_data, scenario_id=scenario_id, trip_id=trip_id)
            if is_duplicate:
                    return BaseResponse(
                        data=None,
                        message=ErrorMessages.DUPLICATE_TRIP_JA,
                        error=ErrorMessages.DUPLICATE_TRIP_JA,
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )

        serializer = TripUpsertRequestSerializer(data=trip_data, partial=True)
        if not serializer.is_valid():
            return BaseResponse(
                data=None,
                    message=ErrorMessages.TRIP_UPDATE_FAILED_JA,
                    error=serializer.errors,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        validated_data = dict(serializer.validated_data)
        validated_data.pop("scenario_id", None)
        validated_data.pop("route_id", None)
        updated = _update_trip_with_stop_times(instance=trip, validated_data=validated_data)
        update_scenario_edit_state(scenario_id, "trips_data")

        stop_times = list(
            StopTimes.objects.filter(
                scenario_id=scenario_id,
                trip_id=updated.trip_id,
            ).order_by("stop_sequence")
        )

        updated._prefetched_stop_times = stop_times

        stop_ids = [st.stop_id for st in stop_times]
        stop_name_by_stop_id = _build_stop_name_map(scenario_id=str(scenario_id), stop_ids=stop_ids)

        response_data = {
            "trip": TripModelSerializer(updated, context={"stop_name_by_stop_id": stop_name_by_stop_id}).data,
            "stop_times": StopTimesSerializer(stop_times, many=True, context={"stop_name_by_stop_id": stop_name_by_stop_id}).data,
        }
        return BaseResponse(
            data=response_data,
            message="トリップの部分更新が完了しました",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    @transactional
    def bulk_delete(*, scenario_id, trip_ids):
        if not scenario_id:
            return BaseResponse(
                error=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
                message=ErrorMessages.SCENARIO_ID_REQUIRED_JA,
            )

        if not trip_ids:
            return BaseResponse(
                error=ErrorMessages.TRIP_IDS_REQUIRED_FOR_DELETE_JA,
                data=None,
                status_code=status.HTTP_400_BAD_REQUEST,
                message=ErrorMessages.TRIP_IDS_REQUIRED_FOR_DELETE_JA,
            )

        trips_to_delete = list(Trips.objects.filter(scenario_id=scenario_id, trip_id__in=trip_ids))
        found_trip_ids = {trip.trip_id for trip in trips_to_delete}
        not_found_trip_ids = list(set(trip_ids) - found_trip_ids)

        affected_route_ids = {trip.route_id for trip in trips_to_delete}

        for trip in trips_to_delete:
            StopTimes.objects.filter(trip_id=trip.trip_id, scenario_id=scenario_id).delete()
        Trips.objects.filter(scenario_id=scenario_id, trip_id__in=found_trip_ids).delete()

        deleted_route_ids = set()
        for rid in affected_route_ids:
            if not Trips.objects.filter(scenario_id=scenario_id, route_id=rid).exists():
                RouteKeywordMap.objects.filter(scenario_id=scenario_id, route_id=rid).delete()
                Routes.objects.filter(scenario_id=scenario_id, route_id=rid).delete()
                deleted_route_ids.add(rid)

        update_scenario_edit_state(scenario_id, "trips_data")
        if deleted_route_ids:
            update_scenario_edit_state(scenario_id, "routes_data")

        return BaseResponse(
            message="削除処理が完了しました。",
            data={
                "deleted_trip_ids": list(found_trip_ids),
                "not_found_trip_ids": not_found_trip_ids,
            },
            error=None,
            status_code=status.HTTP_200_OK,
        )
