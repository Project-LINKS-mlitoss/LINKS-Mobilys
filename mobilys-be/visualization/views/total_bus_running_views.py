# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from uuid import UUID
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from mobilys_BE.shared.response import BaseResponse

from visualization.services.total_bus_running.core import parse_params
from visualization.services.total_bus_running.payloads import (
    build_total_bus_on_stops_payload,
    build_total_bus_on_stops_by_parents_payload,
    build_total_bus_on_stop_group_detail_payload,
    build_total_bus_on_stop_detail_payload,
)
from gtfs.models import Stops, Scenario

from datetime import datetime

from visualization.constants import DATE_FORMAT, TIME_FORMAT
from visualization.constants.messages import Messages

class TotalBusOnStopsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            date, start_time, end_time, rg_ids, dir_id, svcs, scenario = parse_params(request)
        except (KeyError, ValueError, LookupError) as e:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_PARAM_ERROR_WITH_DETAIL_JA.format(error=str(e)) if isinstance(e, ValueError) else str(e),
                error=Messages.TOTAL_BUS_PARAM_ERROR_JA,
                status_code=status.HTTP_400_BAD_REQUEST)
        
        data = build_total_bus_on_stops_payload(
            scenario=scenario,
            date=date,
            start_time=start_time,
            end_time=end_time,
            rg_ids=rg_ids,
            dir_id=dir_id,
            svcs=svcs,
        )
        return BaseResponse.success(
            message=Messages.TOTAL_BUS_RETRIEVED_SUCCESSFULLY_JA,
            data=data,
            status_code=status.HTTP_200_OK
        )


class TotalBusOnStopsByParentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Parse parameters (unchanged)
        try:
            date, start_time, end_time, rg_ids, dir_id, svcs, scenario = parse_params(request)
        except (KeyError, ValueError, LookupError) as e:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_PARAM_ERROR_WITH_DETAIL_JA.format(error=str(e)) if isinstance(e, ValueError) else str(e),
                error=Messages.TOTAL_BUS_PARAM_ERROR_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        data = build_total_bus_on_stops_by_parents_payload(
            scenario=scenario,
            date=date,
            start_time=start_time,
            end_time=end_time,
            rg_ids=rg_ids,
            dir_id=dir_id,
            svcs=svcs,
        )
        return BaseResponse.success(
            message=Messages.TOTAL_BUS_RETRIEVED_SUCCESSFULLY_JA,
            data=data,
            status_code=status.HTTP_200_OK
        )


class TotalBusOnStopGroupDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sc_id = request.query_params.get('scenario_id')
        pid   = request.query_params.get('stop_id')
        if not sc_id or not pid:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_SCENARIO_AND_STOP_ID_REQUIRED_JA,
                error=Messages.TOTAL_BUS_SCENARIO_AND_STOP_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )
        try:
            scenario = Scenario.objects.get(id=sc_id)
        except Scenario.DoesNotExist:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_SCENARIO_NOT_FOUND_JA,
                error=Messages.TOTAL_BUS_SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # --- 2) parse date/time ---
        date_str  = request.query_params.get('date')
        start_str = request.query_params.get('start_time')
        end_str   = request.query_params.get('end_time')
        date = None
        if date_str:
            try: date = datetime.strptime(date_str, DATE_FORMAT).date()
            except ValueError:
                return BaseResponse.error(
                    message=Messages.TOTAL_BUS_INVALID_DATE_FORMAT_JA,
                    error=Messages.TOTAL_BUS_INVALID_DATE_FORMAT_JA,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        start_time = None
        if start_str:
            try: start_time = datetime.strptime(start_str, TIME_FORMAT).time()
            except ValueError:
                return BaseResponse.error(
                    message=Messages.TOTAL_BUS_INVALID_START_TIME_FORMAT_JA,
                    error=Messages.TOTAL_BUS_INVALID_START_TIME_FORMAT_JA,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        end_time = None
        if end_str:
            try: end_time = datetime.strptime(end_str, TIME_FORMAT).time()
            except ValueError:
                return BaseResponse.error(
                    message=Messages.TOTAL_BUS_INVALID_END_TIME_FORMAT_JA,
                    error=Messages.TOTAL_BUS_INVALID_END_TIME_FORMAT_JA,
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        # --- 3) parse filters ---
        raw_services = request.query_params.get('service_id')
        service_ids = [s.strip() for s in (raw_services or "").split(',') if s.strip()]
        dir_raw = request.query_params.get('direction_id')
        direction_id = None
        if dir_raw not in (None, '', ' '):
            try: direction_id = int(dir_raw)
            except ValueError:
                return BaseResponse.error(
                    message=Messages.TOTAL_BUS_INVALID_DIRECTION_ID_JA,
                    error=Messages.TOTAL_BUS_INVALID_DIRECTION_ID_JA,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            
        raw_rg    = request.query_params.get("route_group_ids")
        rg_ids    = [UUID(x) for x in raw_rg.split(",")] if raw_rg else None

        # --- 4) grouping method & parent lookup ---
        try:
            pid = int(pid)
        except ValueError:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_INVALID_PARENT_STOP_ID_JA,
                error=Messages.TOTAL_BUS_INVALID_PARENT_STOP_ID_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        parent_label, stops_details = build_total_bus_on_stop_group_detail_payload(
            scenario=scenario,
            parent_id=pid,
            date=date,
            start_time=start_time,
            end_time=end_time,
            service_ids=service_ids,
            direction_id=direction_id,
            route_group_ids=rg_ids,
        )
        if not stops_details:
            return BaseResponse(
                message=Messages.TOTAL_BUS_PARENT_STOP_NOT_FOUND_JA,
                data={
                    "stop_group_name": parent_label,
                    "stops": []
                },
                error=Messages.TOTAL_BUS_PARENT_STOP_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        return BaseResponse.success(
            message=Messages.TOTAL_BUS_RETRIEVED_SUCCESSFULLY_JA,
            data={
                "stop_group_name": parent_label,
                "stops": stops_details
            },
            status_code=status.HTTP_200_OK
        )


class TotalBusOnStopDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sc_id   = request.query_params.get("scenario_id")
        stop_id = request.query_params.get("stop_id")
        if not sc_id or not stop_id:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_SCENARIO_AND_STOP_ID_REQUIRED_JA,
                error=Messages.TOTAL_BUS_SCENARIO_AND_STOP_ID_REQUIRED_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # 1) get scenario
        try:
            scenario = Scenario.objects.get(id=sc_id)
        except Scenario.DoesNotExist:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_SCENARIO_NOT_FOUND_JA,
                error=Messages.TOTAL_BUS_SCENARIO_NOT_FOUND_JA,
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            Stops.objects.get(scenario=scenario, stop_id=stop_id)
        except Stops.DoesNotExist:
            return BaseResponse.error(
                message=Messages.TOTAL_BUS_STOP_NOT_FOUND_JA,
                error=Messages.TOTAL_BUS_STOP_NOT_FOUND_JA,
                status_code=status.HTTP_404_NOT_FOUND
            )

        # 4) parse date/time + filters
        date_str     = request.query_params.get("date")
        start_str    = request.query_params.get("start_time")
        end_str      = request.query_params.get("end_time")
        raw_services = request.query_params.get("service_id")
        raw_dir      = request.query_params.get("direction_id")
        raw_rg       = request.query_params.get("route_group_ids")

        date = None
        if date_str:
            try: date = datetime.strptime(date_str, DATE_FORMAT).date()
            except ValueError: pass

        start_time = None
        if start_str:
            try: start_time = datetime.strptime(start_str, TIME_FORMAT).time()
            except ValueError: pass

        end_time = None
        if end_str:
            try: end_time = datetime.strptime(end_str, TIME_FORMAT).time()
            except ValueError: pass

        service_ids = [s.strip() for s in (raw_services or "").split(",") if s.strip()]
        direction_id = None
        if raw_dir not in (None, "", " "):
            try: direction_id = int(raw_dir)
            except ValueError: pass

        rg_ids = [UUID(x) for x in raw_rg.split(",") if x.strip()] if raw_rg else None

        data = build_total_bus_on_stop_detail_payload(
            scenario=scenario,
            stop_id=stop_id,
            date=date,
            start_time=start_time,
            end_time=end_time,
            service_ids=service_ids,
            direction_id=direction_id,
            route_group_ids=rg_ids,
        )

        return BaseResponse.success(
            message=Messages.TOTAL_BUS_RETRIEVED_SUCCESSFULLY_JA,
            data=data,
            status_code=status.HTTP_200_OK
        )
