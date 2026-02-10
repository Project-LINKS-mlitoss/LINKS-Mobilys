from django.urls import path

from ..views.poi_views import (
    POIByBBoxAPIView,
    POIDBByBBoxAPIView,
    POICheckAPIView,
    POIAPIView,
    SetActivePOIBatchAPIView,
    POIBatchDownloadAPIView,
)

urlpatterns = [
    # New Phase 1 POI endpoints
    path("poi/bbox/", POIByBBoxAPIView.as_view(), name="poi-bbox"),
    path("poi/db_bbox/", POIDBByBBoxAPIView.as_view(), name="poi-db-bbox"),

    # ADD these two routes under the POI section
    path("poi/bbox/", POIByBBoxAPIView.as_view(), name="poi-bbox"),
    path("poi/db_bbox/", POIDBByBBoxAPIView.as_view(), name="poi-db-bbox"),
    path("poi/check/", POICheckAPIView.as_view(), name="poi-check"),
    path("poi/", POIAPIView.as_view(), name="poi"),
    path("poi/set_active_batch/", SetActivePOIBatchAPIView.as_view(), name="poi-set-active-batch"),
    path("poi/download_batch/", POIBatchDownloadAPIView.as_view(), name="poi-download-batch"),
]
