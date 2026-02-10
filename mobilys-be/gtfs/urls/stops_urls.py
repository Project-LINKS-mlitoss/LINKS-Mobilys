from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from gtfs.views.stop_views import (
    StopEditViewSet,
    StopIdKeywordUpdateViewSet,
    StopNameKeywordsUpdateViewSet,
    StopViewSet,
    StopsGroupDataViewSet,
    StopsGroupingDataViewSet,
    StopsGroupingMethodViewSet,
)

router = DefaultRouter()

# Keep paths stable
router.register(r"stops/grouping", StopsGroupingDataViewSet, basename="gtfs-stops-grouping")
router.register(r"stops/grouping/method", StopsGroupingMethodViewSet, basename="gtfs-stops-grouping-method")
router.register(r"edit/stops", StopEditViewSet, basename="gtfs-stops-edit")
router.register(r"edit/stop/groups", StopsGroupDataViewSet, basename="gtfs-stop-groups-edit")
router.register(r"stops", StopViewSet, basename="gtfs-stops")

urlpatterns = router.urls + [
    path(
        "edit/stops/<str:scenario_id>/<str:stop_id>/",
        StopEditViewSet.as_view(
            {
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="gtfs-stops-edit-update",
    ),
    path(
        "edit/stop-name-keywords/<int:stop_group_id>/",
        StopNameKeywordsUpdateViewSet.as_view(
            {
                "put": "update",
                "patch": "partial_update",
            }
        ),
        name="gtfs-stop-name-keywords-update",
    ),
    path(
        "edit/stop-id-keywords/<int:stop_group_id>/",
        StopIdKeywordUpdateViewSet.as_view(
            {
                "put": "update",
                "patch": "partial_update",
            }
        ),
        name="gtfs-stop-id-keywords-update",
    ),
    # Optional: path-scoped scenario
    path(
        "edit/stop-name-keywords/<str:scenario_id>/<int:stop_group_id>/",
        StopNameKeywordsUpdateViewSet.as_view(
            {
                "put": "update",
                "patch": "partial_update",
            }
        ),
        name="gtfs-stop-name-keywords-update-with-scenario",
    ),
    path(
        "edit/stop-id-keywords/<str:scenario_id>/<int:stop_group_id>/",
        StopIdKeywordUpdateViewSet.as_view(
            {
                "put": "update",
                "patch": "partial_update",
            }
        ),
        name="gtfs-stop-id-keywords-update-with-scenario",
    ),
]

