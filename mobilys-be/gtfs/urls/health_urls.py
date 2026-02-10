from __future__ import annotations

from django.urls import path

from gtfs.views.health_views import HealthViews

urlpatterns = [
    path("health/", HealthViews.as_view(), name="gtfs-health-check"),
]

