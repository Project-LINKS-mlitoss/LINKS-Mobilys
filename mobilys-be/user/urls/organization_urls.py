# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
Organization-related URLs for user app.
"""
from rest_framework.routers import DefaultRouter
from user.views.organization_views import OrganizationViewSet

# Router for OrganizationViewSet
router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet, basename='organization')

__all__ = ['router']
