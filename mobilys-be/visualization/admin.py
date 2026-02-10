# your_app_name/admin.py

from django.contrib import admin
from django.contrib.gis import admin as gis_admin

from .models import (
    PoiBatch,
    PointOfInterests,
    PopulationMesh,
    MeshLocation,
    ProjectPrefectureSelection,
    UserPrefectureSelection,
)


@admin.register(PoiBatch)
class PoiBatchAdmin(admin.ModelAdmin):
    """Admin for POI import batches."""
    list_display = ("id", "user", "file_name", "created_at")
    list_filter = ("user", "created_at")
    search_fields = ("file_name", "remark", "user__username", "user__email")
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)


@admin.register(PointOfInterests)
class PointOfInterestsAdmin(admin.ModelAdmin):
    """Admin for individual POIs."""
    list_display = ("id", "user", "batch", "type", "name", "lat", "lng")
    list_filter = ("type", "user", "batch")
    search_fields = (
        "name",
        "type",
        "remark",
        "user__username",
        "user__email",
        "batch__file_name",
    )
    raw_id_fields = ("user", "batch")
    ordering = ("type", "name")


@admin.register(PopulationMesh)
class PopulationMeshAdmin(gis_admin.GISModelAdmin):
    """Admin for population mesh polygons."""
    list_display = ("meshcode", "mcode", "total", "age_0_14", "age_15_64", "age_65_up")
    list_filter = ("mcode",)
    search_fields = ("meshcode", "mcode")
    ordering = ("meshcode",)
    # Geometry editing is usually heavy; keep it read-only if you only need to inspect it.
    readonly_fields = ("geom",)


@admin.register(MeshLocation)
class MeshLocationAdmin(admin.ModelAdmin):
    """Admin for mesh location metadata."""
    list_display = ("meshcode", "mcode", "prefecture_name", "city_name", "city_code")
    list_filter = ("prefecture_name", "city_name")
    search_fields = ("meshcode", "mcode", "prefecture_name", "city_name", "city_code")
    ordering = ("prefecture_name", "city_name", "meshcode")


@admin.register(ProjectPrefectureSelection)
class ProjectPrefectureSelectionAdmin(admin.ModelAdmin):
    list_display = ("project", "prefecture_name", "updated_at")
    search_fields = ("project__project_name", "prefecture_name")


@admin.register(UserPrefectureSelection)
class UserPrefectureSelectionAdmin(admin.ModelAdmin):
    list_display = ("user", "prefecture_name", "updated_at")
    search_fields = ("user__username", "user__email", "prefecture_name")
    raw_id_fields = ("user",)
