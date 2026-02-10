from __future__ import annotations

from collections import defaultdict

from rest_framework import status
from rest_framework.exceptions import ValidationError

from gtfs.constants import ErrorMessages
from gtfs.models import Scenario, Shape, StopTimes, Trips
from gtfs.serializers.shape_serializers import (
    BulkShapeUpdateSerializer,
    CreateShapeFromTripPatternsSerializer,
    GenerateShapeFromCoordinatesOnlySerializer,
    GenerateShapeFromStopsSerializer,
    GenerateShapeSerializer,
)
from gtfs.services.base import log_service_call, transactional
from gtfs.utils.route_data_utils import RouteDataUtils
from gtfs.utils.scenario_utils import update_scenario_edit_state
from gtfs.utils.shape_generator import ShapeGenerator
from mobilys_BE.shared.response import BaseResponse


@log_service_call
class ShapeService:
    @staticmethod
    @transactional
    def generate_shapes(*, payload):
        serializer = GenerateShapeSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        trips = serializer.validated_data.get("trips")
        routes = serializer.validated_data.get("routes")
        is_all_data = serializer.validated_data.get("isAllData")
        scenario_id = serializer.validated_data.get("scenario_id")

        if scenario_id is None:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_ID_NOT_PROVIDED_JA,
                error=ErrorMessages.SCENARIO_ID_REQUIRED_VARIANT_JA,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if is_all_data and not trips and not routes:
            ShapeGenerator.process_create_shapes_all_data(scenario_id)
        elif trips and not routes:
            ShapeGenerator.process_create_shapes_data_from_database_by_trips(trips, scenario_id)
        elif routes and not trips:
            ShapeGenerator.process_create_shapes_data_from_database_by_route(routes, scenario_id)
        else:
            raise ValidationError(ErrorMessages.AT_LEAST_ONE_TRIP_ROUTE_OR_ALLDATA_REQUIRED_JA)

        return BaseResponse(
            data=None,
            message="シェイプの生成が成功しました。",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    def generate_shape_from_stops(*, payload):
        serializer = GenerateShapeFromStopsSerializer(data=payload)
        if not serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_PAYLOAD_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        stops = serializer.validated_data["stops"]
        route_type = serializer.validated_data.get("route_type", 3)
        coordinate_keys = tuple(serializer.validated_data.get("coordinate_keys") or ["stop_lon", "stop_lat"])

        try:
            shape_points = ShapeGenerator.generate_shape_from_stops(
                stops=stops,
                route_type=route_type,
                coordinate_keys=coordinate_keys,
            )
        except ValueError as e:
            return BaseResponse(
                data=None,
                message=str(e),
                error=str(e),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SHAPE_GENERATION_FAILED_EN,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse(
            data=shape_points,
            message="Shape generated",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    def generate_shape_from_coordinates_only(*, payload):
        serializer = GenerateShapeFromCoordinatesOnlySerializer(data=payload)
        if not serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_PAYLOAD_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        coordinates = serializer.validated_data["coordinates"]
        route_type = serializer.validated_data.get("route_type", 3)
        coord_format = serializer.validated_data.get("coord_format", "lon_lat")

        try:
            shape_points = ShapeGenerator.generate_shape_from_coordinates_only(
                coordinates=[(c[0], c[1]) for c in coordinates],
                route_type=route_type,
                coord_format=coord_format,
            )
        except ValueError as e:
            return BaseResponse(
                data=None,
                message=str(e),
                error=str(e),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SHAPE_GENERATION_FAILED_EN,
                error=str(e),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return BaseResponse(
            data=shape_points,
            message="Shape generated",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    @transactional
    def bulk_update(*, payload, scenario_id=None, require_all_fields=False):
        serializer = BulkShapeUpdateSerializer(data=payload)
        if not serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_PAYLOAD_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        body_scenario_id = serializer.validated_data.get("scenario_id")
        if scenario_id is None:
            scenario_id = body_scenario_id
        if body_scenario_id and scenario_id and str(body_scenario_id) != str(scenario_id):
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_ID_MISMATCH_EN,
                error={"scenario_id": "Path scenario_id and body scenario_id do not match."},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if not scenario_id:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_ID_REQUIRED_EN_LOWER,
                error={"scenario_id": ErrorMessages.SCENARIO_ID_REQUIRED_PATH_OR_BODY_EN},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            Scenario.objects.only("id").get(id=scenario_id)
        except Scenario.DoesNotExist:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_EN,
                error=ErrorMessages.SCENARIO_NOT_FOUND_EN,
                status_code=status.HTTP_404_NOT_FOUND,
            )

        upsert = serializer.validated_data.get("upsert", False)
        items = serializer.validated_data["shapes"]

        if require_all_fields:
            missing_fields = []
            for it in items:
                if "shape_pt_lat" not in it or "shape_pt_lon" not in it:
                    missing_fields.append(
                        {"shape_id": it.get("shape_id"), "shape_pt_sequence": it.get("shape_pt_sequence")}
                    )
            if missing_fields:
                return BaseResponse(
                    data=None,
                    message=ErrorMessages.SHAPE_PT_LAT_LON_REQUIRED_FOR_PUT_EN,
                    error={"missing_lat_lon": missing_fields},
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        shape_ids = {it["shape_id"] for it in items}
        existing_qs = Shape.objects.filter(scenario_id=scenario_id, shape_id__in=shape_ids).only(
            "id",
            "shape_id",
            "shape_pt_sequence",
            "shape_pt_lat",
            "shape_pt_lon",
            "shape_dist_traveled",
        )
        existing_map = {(s.shape_id, s.shape_pt_sequence): s for s in existing_qs}

        to_update = []
        to_create = []
        missing = []
        upsert_missing_latlon = []

        for it in items:
            key = (it["shape_id"], it["shape_pt_sequence"])
            obj = existing_map.get(key)

            if obj is None:
                if not upsert:
                    missing.append({"shape_id": key[0], "shape_pt_sequence": key[1]})
                    continue

                if "shape_pt_lat" not in it or "shape_pt_lon" not in it:
                    upsert_missing_latlon.append({"shape_id": key[0], "shape_pt_sequence": key[1]})
                    continue

                to_create.append(
                    Shape(
                        scenario_id=scenario_id,
                        shape_id=it["shape_id"],
                        shape_pt_sequence=it["shape_pt_sequence"],
                        shape_pt_lat=it["shape_pt_lat"],
                        shape_pt_lon=it["shape_pt_lon"],
                        shape_dist_traveled=it.get("shape_dist_traveled"),
                    )
                )
                continue

            if "shape_pt_lat" in it:
                obj.shape_pt_lat = it["shape_pt_lat"]
            if "shape_pt_lon" in it:
                obj.shape_pt_lon = it["shape_pt_lon"]
            if "shape_dist_traveled" in it:
                obj.shape_dist_traveled = it["shape_dist_traveled"]
            to_update.append(obj)

        if missing:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SOME_SHAPE_POINTS_DO_NOT_EXIST_EN,
                error={"missing": missing},
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if upsert_missing_latlon:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SHAPE_PT_LAT_LON_REQUIRED_TO_UPSERT_EN,
                error={"missing_lat_lon": upsert_missing_latlon},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if to_update:
            Shape.objects.bulk_update(to_update, ["shape_pt_lat", "shape_pt_lon", "shape_dist_traveled"])
        if to_create:
            Shape.objects.bulk_create(to_create)
        update_scenario_edit_state(scenario_id, "shapes_data")

        return BaseResponse(
            data={"updated": len(to_update), "created": len(to_create)},
            message="Shapes updated",
            error=None,
            status_code=status.HTTP_200_OK,
        )

    @staticmethod
    def _bulk_compute_pattern_hashes(scenario_id, trip_ids: list) -> dict:
        if not trip_ids:
            return {}

        stop_times = list(
            StopTimes.objects.filter(scenario_id=scenario_id, trip_id__in=trip_ids)
            .order_by("trip_id", "stop_sequence")
            .values("trip_id", "stop_id")
        )

        trip_stop_ids = defaultdict(list)
        for st in stop_times:
            trip_stop_ids[st["trip_id"]].append(str(st["stop_id"]))

        result = {}
        for trip_id, stop_ids in trip_stop_ids.items():
            result[trip_id] = RouteDataUtils._compute_pattern_hash_from_ids(stop_ids) if stop_ids else None
        return result

    @staticmethod
    def _get_trip_ids_for_pattern(pattern: dict) -> list[str]:
        scenario_id = pattern["scenario_id"]
        route_id = pattern["route_id"]
        service_id = pattern["service_id"]
        trip_headsign = pattern.get("trip_headsign") or None
        shape_id = pattern.get("shape_id") or None
        pattern_hash = pattern.get("pattern_hash") or None

        trips_qs = Trips.objects.filter(scenario_id=scenario_id, route_id=route_id, service_id=service_id)

        if "direction_id" in pattern:
            direction_id = pattern.get("direction_id")
            if direction_id is None:
                trips_qs = trips_qs.filter(direction_id__isnull=True)
            else:
                trips_qs = trips_qs.filter(direction_id=int(direction_id))

        if trip_headsign:
            trips_qs = trips_qs.filter(trip_headsign=trip_headsign)
        if shape_id:
            trips_qs = trips_qs.filter(shape_id=shape_id)

        trips_list = list(trips_qs.only("trip_id"))
        trip_ids = [t.trip_id for t in trips_list]

        if pattern_hash:
            trip_pattern_hashes = ShapeService._bulk_compute_pattern_hashes(scenario_id, trip_ids)
            trip_ids = [tid for tid in trip_ids if trip_pattern_hashes.get(tid) == pattern_hash]

        return trip_ids

    @staticmethod
    @transactional
    def create_from_trip_patterns(*, payload):
        serializer = CreateShapeFromTripPatternsSerializer(data=payload)
        if not serializer.is_valid():
            return BaseResponse(
                data=None,
                message=ErrorMessages.INVALID_PAYLOAD_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        trip_patterns = serializer.validated_data["trip_patterns"]
        shape_payload = serializer.validated_data["shape"]

        scenario_id = trip_patterns[0]["scenario_id"]
        shape_id = shape_payload["shape_id"]
        coordinates = shape_payload["coordinates"]

        try:
            Scenario.objects.only("id").get(id=scenario_id)
        except Scenario.DoesNotExist:
            return BaseResponse(
                data=None,
                message=ErrorMessages.SCENARIO_NOT_FOUND_EN,
                error=ErrorMessages.SCENARIO_NOT_FOUND_EN,
                status_code=status.HTTP_404_NOT_FOUND,
            )

        all_trip_ids = set()
        pattern_stats = []
        for patt in trip_patterns:
            trip_ids = ShapeService._get_trip_ids_for_pattern(patt)
            all_trip_ids.update(trip_ids)
            pattern_stats.append(
                {
                    "route_id": patt.get("route_id"),
                    "service_id": patt.get("service_id"),
                    "direction_id": patt.get("direction_id", None),
                    "trip_headsign": patt.get("trip_headsign", None),
                    "pattern_hash": patt.get("pattern_hash", None),
                    "matched_trips": len(trip_ids),
                }
            )

        coords_sorted = sorted(coordinates, key=lambda x: x["shape_pt_sequence"])
        shapes_to_create = [
            Shape(
                scenario_id=scenario_id,
                shape_id=shape_id,
                shape_pt_sequence=it["shape_pt_sequence"],
                shape_pt_lat=it["shape_pt_lat"],
                shape_pt_lon=it["shape_pt_lon"],
                shape_dist_traveled=it.get("shape_dist_traveled"),
            )
            for it in coords_sorted
        ]

        Shape.objects.filter(scenario_id=scenario_id, shape_id=shape_id).delete()
        Shape.objects.bulk_create(shapes_to_create)
        if all_trip_ids:
            Trips.objects.filter(scenario_id=scenario_id, trip_id__in=list(all_trip_ids)).update(shape_id=shape_id)
        update_scenario_edit_state(scenario_id, "shapes_data")

        return BaseResponse(
            data={
                "scenario_id": scenario_id,
                "shape_id": shape_id,
                "shape_points_created": len(shapes_to_create),
                "trips_updated": len(all_trip_ids),
                "patterns": pattern_stats,
            },
            message="Shape created and assigned to trips",
            error=None,
            status_code=status.HTTP_200_OK,
        )
