"""
URL configuration for user app.

This module organizes URLs by feature for better maintainability.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from user.urls.project_urls import router as project_router, project_urlpatterns
from user.urls.organization_urls import router as organization_router
from user.urls.role_urls import router as role_router
from user.urls.access_urls import router as access_router
from user.urls.user_urls import user_urlpatterns
from user.urls.auth_urls import auth_urlpatterns

app_name = 'user'

# Main URL patterns
urlpatterns = [
    # Auth URLs
    path('', include(auth_urlpatterns)),
    
    # ViewSet routers
    path('', include(project_router.urls)),
    path('', include(organization_router.urls)),
    path('', include(role_router.urls)),
    path('', include(access_router.urls)),
    
    # Additional project function views
    *project_urlpatterns,
    
    # User function views
    *user_urlpatterns,
]

__all__ = ['urlpatterns', 'app_name']
