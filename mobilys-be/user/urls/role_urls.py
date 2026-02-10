"""
Role-related URLs for user app.
"""
from rest_framework.routers import DefaultRouter
from user.views.role_views import RoleViewSet

# Router for RoleViewSet
router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')

__all__ = ['router']
