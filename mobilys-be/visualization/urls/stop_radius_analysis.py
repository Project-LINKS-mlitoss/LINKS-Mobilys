from django.urls import path

from ..views.stop_radius_analysis_views import (
    StopGroupBufferAnalysisPostGIS,
    StopGroupBufferAnalysisGraph,
)

urlpatterns = [
    path("stop_group_buffer_analysis/", StopGroupBufferAnalysisPostGIS.as_view(), name="stop_group_buffer_analysis"),
    path("stop_group_buffer_analysis/graph/", StopGroupBufferAnalysisGraph.as_view(), name="stop_group_buffer_analysis_graph"),
]
