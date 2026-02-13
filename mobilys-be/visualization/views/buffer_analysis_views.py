# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import logging

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from mobilys_BE.shared.response import BaseResponse
from visualization.serializers.request.buffer_analysis_serializers import (
    BufferAnalysisNearestStopsQuerySerializer,
    BufferAnalysisQuerySerializer,
    BufferAnalysisGraphQuerySerializer,
    BufferAnalysisRoutesQuerySerializer,
)
from visualization.constants import (
    DEFAULT_MAX_TRANSFERS,
    DEFAULT_MAX_WALK_DISTANCE_M,
    WALKING_SPEED_KMH_TO_MPS,
)
from visualization.services.buffer_analysis import (
    get_stops_within_radius_with_query,
    build_buffer_analysis_payload,
    build_buffer_analysis_graph_payload,
    build_all_routes_geojson,
)
from visualization.utils.share_util import normalize_project_id
from visualization.constants.messages import Messages

logger = logging.getLogger(__name__)

class BufferAnalysisNearestStopsAPIQueryView(APIView):

    def get(self, request):
        """
        Test nearest stops query with spatial filtering.
        
        Query Parameters:
            - scenario_id: Scenario identifier (required)
            - lat: Origin latitude (required)
            - lon: Origin longitude (required)
            - departure_date: Departure date (required)
            - departure_time: Departure time (required)
            - walking_speed: Walking speed in km/h (required)
            - max_travel_time: Maximum travel time in minutes (required)
        """
        serializer = BufferAnalysisNearestStopsQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        lat = params.get("lat")
        lon = params.get("lon")
        departure_time = params.get("departure_time")
        walking_speed = params.get("walking_speed")
        max_travel_time = params.get("max_travel_time")

        try:
            walking_speed_mps = float(walking_speed) / WALKING_SPEED_KMH_TO_MPS if walking_speed is not None else None
            radius = walking_speed_mps * (float(max_travel_time) * 60) if walking_speed_mps is not None and max_travel_time is not None else None
            departure_time_str = departure_time.strftime("%H:%M:%S") if departure_time else None
            stops_available = get_stops_within_radius_with_query(
                scenario_id, lat, lon, radius, departure_time_str, walking_speed_mps
            )
        except ValueError:
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=Messages.INVALID_QUERY_NUMERIC_FIELDS_EN,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return BaseResponse.success(
            message=Messages.API_TEST_SUCCESS_EN,
            data={
                "data": stops_available,
                "total_stops": len(stops_available),
            },
            status_code=status.HTTP_200_OK,
        )


class BufferAnalysisNearestStopsAPIViewOriginals(APIView):
    """
    Buffer analysis endpoint with RAPTOR-based isochrone calculation.
    
    Algorithm: RAPTOR Hybrid (Round-based Public Transit Optimized Router)
    - Provides OTP-comparable coverage
    - Systematic round-based exploration
    - Multi-state Pareto tracking
    - Comprehensive walking transfer integration
    
    GET Parameters:
      - scenario_id (required): GTFS scenario identifier
      - lat (required): Origin latitude
      - lon (required): Origin longitude
      - departure_date (required): Departure date (YYYY-MM-DD)
      - departure_time (required): Departure time (HH:MM or HH:MM:SS)
      - walking_speed (required): Walking speed in km/h
      - max_travel_time (required): Maximum travel time in minutes
      - max_transfers (optional): Maximum number of transfers/rounds (default=2, range: 0-3)
      - max_walk_distance (optional): Maximum walking distance for transfers in meters (default=500)
    
    Note: max_transfers represents RAPTOR rounds:
      - 0 = Direct trips only (no transfers)
      - 1 = One transfer allowed
      - 2 = Two transfers allowed (recommended for comprehensive coverage)
      - 3 = Three transfers allowed (very comprehensive, slower)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = BufferAnalysisQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        lat = params.get("lat")
        lon = params.get("lon")
        departure_date = params.get("departure_date")
        departure_time = params.get("departure_time")
        walking_speed = params.get("walking_speed")
        max_travel_time = params.get("max_travel_time")
        max_transfers = params.get("max_transfers", DEFAULT_MAX_TRANSFERS)
        max_walk_distance = params.get("max_walk_distance", DEFAULT_MAX_WALK_DISTANCE_M)

        result = build_buffer_analysis_payload(
            scenario_id=scenario_id,
            lat=lat,
            lon=lon,
            departure_date=departure_date.strftime("%Y-%m-%d") if departure_date else None,
            departure_time=departure_time.strftime("%H:%M:%S") if departure_time else None,
            walking_speed_kmh=walking_speed,
            max_travel_time=max_travel_time,
            max_transfers=max_transfers,
            max_walk_distance=max_walk_distance,
        )

        return BaseResponse.success(
            message=Messages.BUFFER_ANALYSIS_RETRIEVED_SUCCESSFULLY_EN,
            data=result,
            status_code=status.HTTP_200_OK
        )


class BufferAnalysisGraphAPIView(APIView):
    """
    Buffer analysis graph endpoint with RAPTOR algorithm.
    
    Provides routes, stops, POIs and population data within isochrone area.
    Uses RAPTOR Hybrid algorithm for OTP-comparable coverage.
    
    GET Parameters:
      - scenario_id (required): GTFS scenario identifier
      - lat (required): Origin latitude
      - lon (required): Origin longitude
      - departure_date (optional): Departure date (YYYY-MM-DD)
      - departure_time (optional): Departure time (HH:MM or HH:MM:SS)
      - walking_speed (optional): Walking speed in km/h
      - max_travel_time (optional): Maximum travel time in minutes
      - max_transfers (optional): Maximum number of RAPTOR rounds (default=2)
      - max_walk_distance (optional): Maximum walking distance for transfers in meters (default=500)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        project_id = normalize_project_id(request.query_params.get("project_id"))
        
        serializer = BufferAnalysisGraphQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        scenario_id = params.get("scenario_id")
        lat = params.get("lat")
        lon = params.get("lon")
        departure_date = params.get("departure_date")
        departure_time = params.get("departure_time")
        walking_speed = params.get("walking_speed")
        max_travel_time = params.get("max_travel_time")
        max_transfers = params.get("max_transfers", DEFAULT_MAX_TRANSFERS)
        max_walk_distance = params.get("max_walk_distance", DEFAULT_MAX_WALK_DISTANCE_M)

        if walking_speed is None or max_travel_time is None:
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=Messages.WALKING_SPEED_AND_MAX_TRAVEL_TIME_REQUIRED_EN,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        result = build_buffer_analysis_graph_payload(
            scenario_id=scenario_id,
            lat=lat,
            lon=lon,
            departure_date=departure_date.strftime("%Y-%m-%d") if departure_date else None,
            departure_time=departure_time.strftime("%H:%M:%S") if departure_time else None,
            walking_speed_kmh=walking_speed,
            max_travel_time=max_travel_time,
            user_id=user.id,
            project_id=project_id,
            logger=logger,
            max_transfers=max_transfers,
            max_walk_distance=max_walk_distance,
        )


        return BaseResponse.success(
            message=Messages.BUFFER_ANALYSIS_GRAPH_RETRIEVED_SUCCESSFULLY_EN,
            data=result,
            status_code=status.HTTP_200_OK
        )


class ShowAllRoutesAPIView(APIView):
    """
    API endpoint to display all routes and stops in GeoJSON format.

    Query Parameters:
        - scenario_id (required)
        - is_using_shape_data (optional, default=false)
        - is_using_parent_stop (optional, default=false)

        # Filters
        - date            (YYYY-MM-DD)
        - start_time      (HH:MM or HH:MM:SS)
        - end_time        (HH:MM or HH:MM:SS)
        - route_group_ids (CSV of UUIDs)
        - direction_id    (int or CSV of ints)
        - service_id      (str or CSV)
    """

    def get(self, request):
        serializer = BufferAnalysisRoutesQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            geojson_result = build_all_routes_geojson(request)
        except KeyError:
            return BaseResponse.error(
                message=Messages.INVALID_QUERY_PARAMETERS_EN,
                error=Messages.SCENARIO_ID_REQUIRED_DOT_EN,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except LookupError as exc:
            return BaseResponse.error(
                message=Messages.SCENARIO_NOT_FOUND_EN,
                error=str(exc),
                status_code=status.HTTP_404_NOT_FOUND,
            )

        response = BaseResponse.success(
            message=Messages.ROUTE_DATA_RETRIEVED_SUCCESSFULLY_EN,
            data=geojson_result,
            status_code=status.HTTP_200_OK,
        )
        response.data.update(geojson_result)
        return response
    
