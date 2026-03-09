# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.urls import path
from rest_framework.routers import DefaultRouter

from simulation.views.benefit_calculations_views import BenefitCalculationsViewSet
from simulation.views.co2_views import CO2ByRouteViewSet, CO2TotalsAPIView
from simulation.views.detail_car_routing_views import GetCarRoutingFromDBView, GetCarVolumeFromDBView
from simulation.views.operating_economics_views import OperatingEconomicsViewSet
from simulation.views.ridership_change_views import RidershipChangeViewSet
from simulation.views.simulation_init_views import (
    GetLatestValidationResultView,
    SimulationInitAPIView,
    SimulationInitDiffAPIView,
    SimulationUnionServiceIdsAPIView,
    ValidateAndSaveCSVView,
)
from simulation.views.simulation_summary_views import SimulationSummaryView
from simulation.views.simulation_views import SimulationViewSet
from simulation.views.travel_speed_changes_views import SegmentSpeedMetricsViewSet

app_name = 'simulation'

router = DefaultRouter()

# LIST SIMULATION URLS
router.register(r'data', SimulationViewSet, basename='simulation')

# LIST RIDERSHIP URLS
router.register(r'ridership-change', RidershipChangeViewSet, basename='ridership-change')

# LIST OPERATING ECONOMICS URLS
router.register(r'operating-economics', OperatingEconomicsViewSet, basename='operating-economics')

# LIST BENEFIT CALCULATIONS URLS
router.register(r'benefit-calculations', BenefitCalculationsViewSet, basename='benefit-calculations')

# LIST TRAVEL SPEED CHANGES URLS
router.register(r'travel-speed-changes', SegmentSpeedMetricsViewSet, basename='travel-speed-changes')

# LIST CO2 URLS (router)
router.register(r'co2/by-route', CO2ByRouteViewSet, basename='co2-by-route')

urlpatterns = router.urls + [
    # INIT / SETUP URLS
    path('active-services/', SimulationUnionServiceIdsAPIView.as_view(), name='active-calendar-services'),
    path('init/', SimulationInitAPIView.as_view(), name='simulation-init'),
    path('init/diff/', SimulationInitDiffAPIView.as_view(), name='simulation-init-diff'),

    # DETAIL / QUERY URLS
    path('car-routes-detail/', GetCarRoutingFromDBView.as_view(), name='car-route'),
    path('car-volumes/', GetCarVolumeFromDBView.as_view(), name='car-volume'),
    path('simulation-summary/', SimulationSummaryView.as_view(), name='simulation-summary'),

    # CO2 URLS (non-router)
    path('co2/', CO2TotalsAPIView.as_view(), name='co2-totals'),
    path('co2/totals/', CO2TotalsAPIView.as_view(), name='co2-totals'),

    # VALIDATION URLS
    path('<simulation_id>/validation/validate-and-save/', ValidateAndSaveCSVView.as_view(), name='validate-and-save-csv'),
    path('<simulation_id>/validation-result/', GetLatestValidationResultView.as_view(), name='validation-result'),
]

__all__ = ['urlpatterns', 'app_name']
