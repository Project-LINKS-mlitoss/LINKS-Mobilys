# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from gtfs.models import Map
from gtfs.serializers.request.map_request import SetUserMapRequestSerializer
from gtfs.serializers.response.map_response import MapSerializer
from mobilys_BE.shared.response import BaseResponse
from gtfs.services.map_service import MapService, MapServiceError

class MapListView(viewsets.ModelViewSet):
    queryset = Map.objects.all()
    serializer_class = MapSerializer

class UserMapEditView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        request_serializer = SetUserMapRequestSerializer(data=request.data)
        if not request_serializer.is_valid():
            try:
                MapService.set_user_map(user=request.user, map_id=request.data.get("map_id"))
            except MapServiceError as e:
                return BaseResponse(
                    message=e.message,
                    error=e.error,
                    status_code=e.status_code,
                )

        map_id = request_serializer.validated_data.get("map_id")
        try:
            map_obj = MapService.set_user_map(user=request.user, map_id=map_id)
        except MapServiceError as e:
            return BaseResponse(
                message=e.message,
                error=e.error,
                status_code=e.status_code,
            )
        return BaseResponse(
            message='地図の更新が完了しました',
            data=MapSerializer(map_obj).data,
            status_code=status.HTTP_200_OK
        )
