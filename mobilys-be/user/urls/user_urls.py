"""
User-related URLs for user app.
"""
from django.urls import path
from user.views.user_views import (
    create_user,
    get_user_detail,
    list_users,
    update_user,
    delete_user,
    toggle_user_active,
    change_user_password,
    get_user_projects,
    get_current_user_info,
    get_current_user_accesses,
    get_current_user_projects,
)

user_urlpatterns = [
    # User CRUD
    path('users/', list_users, name='user-list'),
    path('users/create/', create_user, name='user-create'),
    path('users/<int:user_id>/', get_user_detail, name='user-detail'),
    path('users/<int:user_id>/update/', update_user, name='user-update'),
    path('users/<int:user_id>/delete/', delete_user, name='user-delete'),
    path('users/<int:user_id>/toggle-active/', toggle_user_active, name='user-toggle-active'),
    path('users/<int:user_id>/change-password/', change_user_password, name='user-change-password'),
    path('users/<int:user_id>/projects/', get_user_projects, name='user-projects'),
    
    # Current user (me) endpoints
    path('users/me/', get_current_user_info, name='user-me'),
    path('users/me/accesses/', get_current_user_accesses, name='user-me-accesses'),
    path('users/me/projects/', get_current_user_projects, name='user-me-projects'),
]

__all__ = ['user_urlpatterns']
