from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from gtfs.views.gtfs_safe_notices_views import GtfsSafeNoticeRuleListCreateApi
from gtfs.views.gtfs_validator_views import GtfsValidationView
from gtfs.views.scenario_validator_views import ScenarioValidationViewSet

router = DefaultRouter()

# Deprecated (kept for backward compatibility)
router.register(r"validate", ScenarioValidationViewSet, basename="gtfs-scenario-validation")

urlpatterns = router.urls + [
    path("validation/", GtfsValidationView.as_view(), name="gtfs-validation-run"),
    path("safe-notice-rules/", GtfsSafeNoticeRuleListCreateApi.as_view(), name="gtfs-safe-notice-rules-list-create"),
]

