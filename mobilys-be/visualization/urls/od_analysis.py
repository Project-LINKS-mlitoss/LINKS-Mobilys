from django.urls import path

from ..views.od_analysis_views import (
    ODBusStopAPIView,
    ODLastStopAndFirstStopAPIView,
    ODUploadAPIView,
    ODUsageDistributionAPIView,
)

urlpatterns = [
    path("od-analysis/usage-distribution/", ODUsageDistributionAPIView.as_view(), name="od-analysis-usage-distribution"),
    path("od-analysis/last-first-stop/", ODLastStopAndFirstStopAPIView.as_view(), name="od-analysis-last-first-stop"),
    path("od-analysis/bus-stop/", ODBusStopAPIView.as_view(), name="od-analysis-bus-stop"),
    path("od-analysis/upload/", ODUploadAPIView.as_view(), name="od-analysis-upload"),
]
