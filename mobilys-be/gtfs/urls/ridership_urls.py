from __future__ import annotations

from django.urls import path

from gtfs.views.one_detailed_boarding_alighting_views import (
    OneDetailedToBoardingAlightingView,
    OneDetailedToBoardingAlightingWithMetadataView,
)
from gtfs.views.one_detailed_od_views import OneDetailedToODView, OneDetailedToODWithMetadataView
from gtfs.views.ridership_views import (
    AllRidershipUploadsView,
    RidershipExportByUploadView,
    RidershipExportView,
    RidershipRecordListView,
    RidershipUploadDetailView,
    RidershipUploadListView,
    RidershipUploadView,
)

urlpatterns = [
    # -------------------------------
    # RIDERSHIP UPLOAD URLS
    # -------------------------------
    # List all ridership uploads across all scenarios (GET)
    path("ridership/uploads/", AllRidershipUploadsView.as_view(), name="gtfs-ridership-upload-list-all"),
    # Upload a new ridership file (POST)
    path("ridership/<str:scenario_id>/upload/", RidershipUploadView.as_view(), name="gtfs-ridership-upload-create"),
    # Export ridership records for a scenario (GET) - BEFORE uploads list
    path("ridership/<str:scenario_id>/export/", RidershipExportView.as_view(), name="gtfs-ridership-export"),
    # List all ridership uploads for a scenario (GET)
    path("ridership/<str:scenario_id>/uploads/", RidershipUploadListView.as_view(), name="gtfs-ridership-upload-list"),
    # Export ridership records from a specific upload (GET) - BEFORE upload detail
    path(
        "ridership/<str:scenario_id>/uploads/<str:upload_id>/export/",
        RidershipExportByUploadView.as_view(),
        name="gtfs-ridership-upload-export",
    ),
    # Get/Delete a specific ridership upload (GET, DELETE)
    path(
        "ridership/<str:scenario_id>/uploads/<str:upload_id>/",
        RidershipUploadDetailView.as_view(),
        name="gtfs-ridership-upload-detail",
    ),
    # List ridership records for a scenario (GET)
    path(
        "ridership/<str:scenario_id>/records/",
        RidershipRecordListView.as_view(),
        name="gtfs-ridership-record-list",
    ),
    # -------------------------------
    # ONE DETAILED TO BOARDING ALIGHTING CONVERSION URLS
    # -------------------------------
    path(
        "ridership/convert/one-detailed-to-boarding-alighting/",
        OneDetailedToBoardingAlightingView.as_view(),
        name="gtfs-ridership-convert-one-detailed-to-boarding-alighting",
    ),
    path(
        "ridership/convert/one-detailed-to-boarding-alighting/with-metadata/",
        OneDetailedToBoardingAlightingWithMetadataView.as_view(),
        name="gtfs-ridership-convert-one-detailed-to-boarding-alighting-with-metadata",
    ),
    # -------------------------------
    # ONE DETAILED TO OD (ORIGIN-DESTINATION) CONVERSION URLS
    # -------------------------------
    path(
        "ridership/convert/one-detailed-to-od/",
        OneDetailedToODView.as_view(),
        name="gtfs-ridership-convert-one-detailed-to-od",
    ),
    path(
        "ridership/convert/one-detailed-to-od/with-metadata/",
        OneDetailedToODWithMetadataView.as_view(),
        name="gtfs-ridership-convert-one-detailed-to-od-with-metadata",
    ),
]

