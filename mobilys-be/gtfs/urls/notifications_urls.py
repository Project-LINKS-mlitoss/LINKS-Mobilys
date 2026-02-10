from __future__ import annotations

from django.urls import path

from gtfs.views.notification_views import (
    NotificationDetailView,
    NotificationMarkAllReadView,
    NotificationUpdateView,
    NotificationView,
)

urlpatterns = [
    path("notifications/", NotificationView.as_view(), name="gtfs-notifications-list-create"),
    path("notifications/detail/", NotificationDetailView.as_view(), name="gtfs-notifications-detail"),
    path("notifications/<uuid:pk>/", NotificationUpdateView.as_view(), name="gtfs-notifications-update"),
    path("notifications/mark-all-read/", NotificationMarkAllReadView.as_view(), name="gtfs-notifications-mark-all-read"),
]

