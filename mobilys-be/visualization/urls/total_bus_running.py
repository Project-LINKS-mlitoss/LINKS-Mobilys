from django.urls import path

from ..views.total_bus_running_views import (
    TotalBusOnStopsAPIView,
    TotalBusOnStopsByParentsAPIView,
    TotalBusOnStopGroupDetailAPIView,
    TotalBusOnStopDetailAPIView,
)

urlpatterns = [
    path("total-bus-on-stops-by-child/", TotalBusOnStopsAPIView.as_view(), name="fp006-total-bus-on-stops-by-child"),
    path("total-bus-on-stops-by-parents/", TotalBusOnStopsByParentsAPIView.as_view(), name="fp006-total-bus-on-stops-by-parents"),
    path("total-bus-on-stops-detail-parent/", TotalBusOnStopGroupDetailAPIView.as_view(), name="fp006-total-bus-on-stops-detail-parent"),
    path("total-bus-on-stops-detail-child/", TotalBusOnStopDetailAPIView.as_view(), name="fp006-total-bus-on-stops-detail-child"),
]
