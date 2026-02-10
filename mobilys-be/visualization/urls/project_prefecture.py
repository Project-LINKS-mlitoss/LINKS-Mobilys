from django.urls import path

from ..views.project_prefecture_views import ProjectPrefectureSelectionAPIView

urlpatterns = [
    path("project-prefecture/", ProjectPrefectureSelectionAPIView.as_view(), name="project-prefecture-selection"),
]
