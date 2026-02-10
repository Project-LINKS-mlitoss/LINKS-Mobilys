from rest_framework import status, viewsets

from mobilys_BE.shared.response import BaseResponse

from gtfs.serializers.request.route_patterns_request import (
    RoutePatternsCreateExistingRequestSerializer,
    RoutePatternsCreateRequestSerializer,
    RoutePatternsDeleteRequestSerializer,
    RoutePatternsRetrieveRequestSerializer,
    RoutePatternsUpdateStopSequenceRequestSerializer,
)
from gtfs.serializers.response.route_patterns_response import (
    RoutePatternsCreateExistingResponseSerializer,
    RoutePatternsCreateResponseSerializer,
    RoutePatternsDeleteResponseDataSerializer,
    RoutePatternsRetrieveResponseSerializer,
    RoutePatternsUpdateStopSequenceResponseDataSerializer,
)
from gtfs.services.route_patterns_service import RoutePatternsService, RoutePatternsServiceError
from gtfs.utils.serializer_utils import safe_serialize


class RoutePatternViewSet(viewsets.ViewSet):
    def retrieve(self, request, *args, **kwargs):
        request_serializer = RoutePatternsRetrieveRequestSerializer(data={"scenario_id": kwargs.get("pk")})
        request_serializer.is_valid(raise_exception=False)
        validated_data = request_serializer.validated_data

        try:
            data = RoutePatternsService.retrieve(scenario_id=validated_data.get("scenario_id"))
        except RoutePatternsServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        return BaseResponse(
            data=safe_serialize(RoutePatternsRetrieveResponseSerializer, data),
            message="ルートパターンの取得に成功しました。",
            status_code=status.HTTP_200_OK,
            error=None,
        )
    
    def create(self, request):
        request_serializer = RoutePatternsCreateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        validated_data = request_serializer.validated_data

        try:
            data = RoutePatternsService.create_new_route_pattern(
                scenario_id=validated_data.get("scenario_id"),
                route_data=validated_data.get("route_data"),
                trip_data=validated_data.get("trip_data"),
                stop_sequence=validated_data.get("stop_sequence"),
                translations=validated_data.get("translations", []),
            )
        except RoutePatternsServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        return BaseResponse(
            data=safe_serialize(RoutePatternsCreateResponseSerializer, data),
            message="新しいルートとルートパターンが正常に作成されました。",
            status_code=status.HTTP_201_CREATED,
            error=None,
        )
     
        
    def destroy(self, request, *args, **kwargs):
        request_serializer = RoutePatternsDeleteRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        validated_data = request_serializer.validated_data

        try:
            result = RoutePatternsService.delete_route_patterns(
                scenario_id=kwargs.get("pk"),
                route_patterns=validated_data.get("route_patterns"),
            )
        except RoutePatternsServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        response_data = safe_serialize(
            RoutePatternsDeleteResponseDataSerializer,
            {"deleted_trip_ids": result.get("deleted_trip_ids")},
        )
        return BaseResponse(
            data=response_data,
            message=result.get("message"),
            status_code=status.HTTP_200_OK,
            error=result.get("error"),
        )
           
            
    def update(self, request, *args, **kwargs):
        request_serializer = RoutePatternsUpdateStopSequenceRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        validated_data = request_serializer.validated_data

        try:
            result = RoutePatternsService.update_stop_sequence(
                scenario_id=kwargs.get("pk"),
                route_id=validated_data.get("route_id"),
                direction_id=validated_data.get("direction_id"),
                service_id=validated_data.get("service_id"),
                shape_id=validated_data.get("shape_id"),
                new_stop_sequence=validated_data.get("new_stop_sequence"),
            )
        except RoutePatternsServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        response_data = safe_serialize(
            RoutePatternsUpdateStopSequenceResponseDataSerializer,
            {
                "edited_trip_ids": result.get("edited_trip_ids"),
                "stops_count": result.get("stops_count"),
                "new_shape_id": result.get("new_shape_id"),
            },
        )
        return BaseResponse(
            data=response_data,
            message=result.get("message"),
            status_code=status.HTTP_200_OK,
            error=result.get("error"),
        )
        
            
class CreateExistingRoutePatternViewSet(viewsets.ViewSet):
    def create(self, request):
        request_serializer = RoutePatternsCreateExistingRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=False)
        validated_data = request_serializer.validated_data

        try:
            data = RoutePatternsService.create_existing_route_pattern(
                scenario_id=validated_data.get("scenario_id"),
                route_id=validated_data.get("route_id"),
                trip_data=validated_data.get("trip_data"),
                stop_sequence=validated_data.get("stop_sequence"),
            )
        except RoutePatternsServiceError as e:
            return BaseResponse(
                data=e.data,
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )

        return BaseResponse(
            data=safe_serialize(RoutePatternsCreateExistingResponseSerializer, data),
            message="Route pattern added to existing route successfully",
            error=None,
            status_code=status.HTTP_201_CREATED,
        )


