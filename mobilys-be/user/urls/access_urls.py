# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Access-related URLs for user app.
"""
from rest_framework.routers import DefaultRouter
from user.views.access_views import AccessViewSet

# Router for AccessViewSet
router = DefaultRouter()
router.register(r'accesses', AccessViewSet, basename='access')

__all__ = ['router']
