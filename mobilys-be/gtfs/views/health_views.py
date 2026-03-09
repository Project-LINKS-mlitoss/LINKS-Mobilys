# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from mobilys_BE.shared.response import BaseResponse

class HealthViews(APIView):
    def get(self, request):
        return BaseResponse(
            message='サービスは稼働中です。',
            data={
                'status': 'ok'
            },
            status_code=status.HTTP_200_OK
        )