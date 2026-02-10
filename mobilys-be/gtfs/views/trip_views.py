from rest_framework import generics
from rest_framework.views import APIView

from gtfs.models import Trips
from gtfs.serializers.request.trip_request import TripUpsertRequestSerializer
from gtfs.serializers.request.trip_views_request import (
    PreviewShapeCoordinatesRequestSerializer,
    TripBulkDeleteRequestSerializer,
    TripEditGetRequestSerializer,
    TripEditPutPatchRequestSerializer,
    TripListRequestSerializer,
)
from gtfs.serializers.response.trip_response import TripModelSerializer
from gtfs.serializers.response.trip_views_response import (
    PreviewShapeCoordinatesLonLatPairResponseSerializer,
    TripBulkDeleteResponseDataSerializer,
    TripEditResponseDataSerializer,
    TripRoutePatternsRouteResponseSerializer,
)
from gtfs.services.trip_service import PreviewShapeCoordinatesService, TripEditService, TripListCreateService
from gtfs.utils.serializer_utils import safe_serialize


class TripListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = TripModelSerializer

    def get_queryset(self):
        request_serializer = TripListRequestSerializer(data=self.request.query_params)
        request_serializer.is_valid(raise_exception=False)
        return TripListCreateService.get_queryset(scenario_id=self.request.query_params.get("scenario_id"))

    def create(self, request, *args, **kwargs):
        request_serializer = TripUpsertRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = TripListCreateService.create(payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripModelSerializer, response.data["data"])
        return response

    def list(self, request, *args, **kwargs):
        request_serializer = TripListRequestSerializer(data=request.query_params)
        request_serializer.is_valid(raise_exception=False)

        response = TripListCreateService.list(scenario_id=request.query_params.get("scenario_id"))
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripRoutePatternsRouteResponseSerializer, response.data["data"])
        return response


class PreviewShapeCoordinatesAPIView(APIView):
    def post(self, request):
        request_serializer = PreviewShapeCoordinatesRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = PreviewShapeCoordinatesService.post(
            scenario_id=request.data.get("scenario_id"),
            stop_ids=request.data.get("stop_ids"),
        )
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(PreviewShapeCoordinatesLonLatPairResponseSerializer, response.data["data"])
        return response


class TripEditGetDetailEditDataBulkDeleteAPIView(APIView):
    serializer_class = TripModelSerializer
    queryset = Trips.objects.all()

    def get(self, request, scenario_id, trip_id):
        request_serializer = TripEditGetRequestSerializer(data={"scenario_id": scenario_id, "trip_id": trip_id})
        request_serializer.is_valid(raise_exception=False)

        response = TripEditService.get(scenario_id=scenario_id, trip_id=trip_id)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripEditResponseDataSerializer, response.data["data"])
        return response

    def put(self, request, scenario_id, trip_id):
        request_serializer = TripEditPutPatchRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        TripUpsertRequestSerializer(data=(request.data or {}).get("data", {}), partial=True).is_valid(raise_exception=False)

        response = TripEditService.put(scenario_id=scenario_id, trip_id=trip_id, payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripModelSerializer, response.data["data"])
        return response

    def patch(self, request, scenario_id, trip_id):
        request_serializer = TripEditPutPatchRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        TripUpsertRequestSerializer(data=(request.data or {}).get("data", {}), partial=True).is_valid(raise_exception=False)

        response = TripEditService.patch(scenario_id=scenario_id, trip_id=trip_id, payload=request.data)
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripEditResponseDataSerializer, response.data["data"])
        return response

    def post(self, request, *args, **kwargs):
        request_serializer = TripBulkDeleteRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)

        response = TripEditService.bulk_delete(
            scenario_id=request.data.get("scenario_id"),
            trip_ids=request.data.get("trip_ids", []),
        )
        if isinstance(getattr(response, "data", None), dict) and response.data.get("data") is not None:
            response.data["data"] = safe_serialize(TripBulkDeleteResponseDataSerializer, response.data["data"])
        return response
