from __future__ import annotations

from rest_framework.routers import DefaultRouter

from gtfs.views.route_patterns_views import CreateExistingRoutePatternViewSet, RoutePatternViewSet

router = DefaultRouter()

# Keep paths stable
router.register(r"edit/route/new/pattern", RoutePatternViewSet, basename="gtfs-route-pattern-new")
router.register(
    r"edit/route/existing/pattern",
    CreateExistingRoutePatternViewSet,
    basename="gtfs-route-pattern-existing",
)

urlpatterns = router.urls

