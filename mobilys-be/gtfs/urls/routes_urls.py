from __future__ import annotations

from rest_framework.routers import DefaultRouter

from gtfs.views.route_views import RouteGroupKeywordViewSet, RouteKeywordViewSet, RoutesGroupingDataViewSet

router = DefaultRouter()

# Keep paths stable
router.register(r"routes/grouping", RoutesGroupingDataViewSet, basename="gtfs-routes-grouping")
router.register(r"routes/grouping/color", RouteKeywordViewSet, basename="gtfs-routes-grouping-color")
router.register(r"routes/keyword/grouping", RouteGroupKeywordViewSet, basename="gtfs-routes-keyword-grouping")

urlpatterns = router.urls

