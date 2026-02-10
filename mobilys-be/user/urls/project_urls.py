"""
Project-related URLs for user app.
"""
from django.urls import path
from rest_framework.routers import DefaultRouter
from user.views.project_views import (
    ProjectViewSet,
    assign_users_to_project,
    unassign_user_from_project,
    bulk_unassign_users_from_project,
    get_project_users,
    clear_project_users,
    assign_organization_users_to_project,
    remove_organization_users_from_project,
)

# Router for ProjectViewSet
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')

# Additional project function views
project_urlpatterns = [
    path('projects/<uuid:project_id>/assign-users/', assign_users_to_project, name='project-assign-users'),
    path('projects/<uuid:project_id>/unassign-user/<int:user_id>/', unassign_user_from_project, name='project-unassign-user'),
    path('projects/<uuid:project_id>/bulk-unassign-users/', bulk_unassign_users_from_project, name='project-bulk-unassign-users'),
    path('projects/<uuid:project_id>/users/', get_project_users, name='project-users'),
    path('projects/<uuid:project_id>/clear-users/', clear_project_users, name='project-clear-users'),
    path('projects/<uuid:project_id>/assign-organization-users/', assign_organization_users_to_project, name='project-assign-org-users'),
    path('projects/<uuid:project_id>/remove-organization-users/', remove_organization_users_from_project, name='project-remove-org-users'),
]

__all__ = ['router', 'project_urlpatterns']
