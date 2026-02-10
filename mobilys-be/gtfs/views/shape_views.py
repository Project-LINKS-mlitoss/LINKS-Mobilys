from rest_framework import viewsets
from rest_framework.views import APIView

from gtfs.serializers.request.shape_request import (
    BulkShapeUpdateSerializer,
    CreateShapeFromTripPatternsSerializer,
    GenerateShapeFromCoordinatesOnlySerializer,
    GenerateShapeFromStopsSerializer,
    GenerateShapeSerializer,
)
from gtfs.serializers.response.shape_response import (
    ShapeBulkUpdateResultDataResponseSerializer,
    ShapeCreateFromTripPatternsResultDataResponseSerializer,
    ShapeGenerateShapesResponseSerializer,
    ShapePointResponseSerializer,
)
from gtfs.services.shape_service import ShapeService
from gtfs.utils.serializer_utils import safe_serialize


class ShapeGeneratorViewSet(viewsets.GenericViewSet):
    """
    ViewSet for generating shapes from trips or routes or all data.
    """

    serializer_class = GenerateShapeSerializer

    def create(self, request, *args, **kwargs):
        request_serializer = GenerateShapeSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = ShapeService.generate_shapes(payload=request.data)
        if isinstance(getattr(response, "data", None), dict):
            response.data = safe_serialize(ShapeGenerateShapesResponseSerializer, response.data)
        return response


class GenerateShapeFromStopsAPIView(APIView):
    """
    Generate shape points from a list of stop dictionaries (no DB access).

    POST `generate/shape/from-stops/`
    """

    def post(self, request):
        request_serializer = GenerateShapeFromStopsSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = ShapeService.generate_shape_from_stops(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(ShapePointResponseSerializer, response.data["data"])
        return response


class GenerateShapeFromCoordinatesOnlyAPIView(APIView):
    """
    Generate shape points from a list of coordinates (no DB access).

    POST `generate/shape/from-coordinates/`
    """

    def post(self, request):
        request_serializer = GenerateShapeFromCoordinatesOnlySerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = ShapeService.generate_shape_from_coordinates_only(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(ShapePointResponseSerializer, response.data["data"])
        return response


class ShapeBulkUpdateAPIView(APIView):
    """
    Bulk edit Shape rows (unique key: scenario_id + shape_id + shape_pt_sequence).

    PATCH/PUT `edit/shapes/<scenario_id>/bulk-update/`
    """

    def patch(self, request, scenario_id=None):
        request_serializer = BulkShapeUpdateSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = ShapeService.bulk_update(payload=request.data, scenario_id=scenario_id, require_all_fields=False)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(ShapeBulkUpdateResultDataResponseSerializer, response.data["data"])
        return response

    def put(self, request, scenario_id=None):
        request_serializer = BulkShapeUpdateSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = ShapeService.bulk_update(payload=request.data, scenario_id=scenario_id, require_all_fields=True)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(ShapeBulkUpdateResultDataResponseSerializer, response.data["data"])
        return response


class CreateShapeFromTripPatternsAPIView(APIView):
    """
    Create/replace a Shape (shape points) and assign it to trips matched by trip_patterns.

    POST `edit/shapes/from-trip-patterns/`
    """

    def post(self, request):
        request_serializer = CreateShapeFromTripPatternsSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = ShapeService.create_from_trip_patterns(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(
                ShapeCreateFromTripPatternsResultDataResponseSerializer, response.data["data"]
            )
        return response
