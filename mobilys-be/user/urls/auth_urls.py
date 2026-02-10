"""
Auth-related URLs for user app.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenBlacklistView

# Import auth views (keeping original for complex login logic)
from user.views.auth_views import CustomTokenObtainPairView, CustomTokenRefreshView

auth_urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='user-login'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='user-token-refresh'),
    path('logout/', TokenBlacklistView.as_view(), name='user-logout'),
]

__all__ = ['auth_urlpatterns']
