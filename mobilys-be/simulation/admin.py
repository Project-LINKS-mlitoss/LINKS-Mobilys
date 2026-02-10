from django.contrib import admin

from .models import (
    Simulation,
    SimulationInput,
    RidershipChange,
    OperatingEconomics,
    DrmLinksRaw,
    DrmKasyoRaw,
    DrmKasyoDedup,
    DrmLinks,
    DrmLinksVerticesPgr,
    CarRouting,
    CarRoutingSegment,
    SegmentSpeedMetrics,
    BenefitCalculations,
    CO2Reduction,
    SimulationValidationResult,
)


@admin.register(Simulation)
class SimulationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "user__username")
    raw_id_fields = ("user", "scenario", "original_scenario", "duplicated_scenario")
    ordering = ("-created_at",)


@admin.register(SimulationInput)
class SimulationInputAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "service_date",
        "service_id",
        "status",
        "created_at",
    )
    list_filter = ("status", "service_date")
    search_fields = ("simulation__name", "service_id")
    raw_id_fields = ("simulation",)
    ordering = ("-created_at",)


@admin.register(RidershipChange)
class RidershipChangeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "route_id",
        "day_type",
        "gtfs_service_id",
        "status",
    )
    list_filter = ("status", "day_type")
    search_fields = ("route_id", "gtfs_service_id", "simulation__name")
    raw_id_fields = ("simulation", "simulation_input")


@admin.register(OperatingEconomics)
class OperatingEconomicsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "route_id",
        "service_id",
        "route_length_km",
        "cost_per_vkm_yen",
        "status",
    )
    list_filter = ("status", "service_id")
    search_fields = ("route_id", "simulation__name")
    raw_id_fields = ("simulation", "simulation_input")


# --- DRM raw / processed link tables (read-only helpers) ---


@admin.register(DrmLinksRaw)
class DrmLinksRawAdmin(admin.ModelAdmin):
    list_display = ("id", "pref_code", "matchcode", "link_cd", "link_len", "traffic12")
    list_filter = ("pref_code",)
    search_fields = ("matchcode", "link_cd")


@admin.register(DrmKasyoRaw)
class DrmKasyoRawAdmin(admin.ModelAdmin):
    list_display = ("pref_code", "join_key_csv", "road_name", "length_km_csv")
    list_filter = ("pref_code",)
    search_fields = ("join_key_csv", "road_name")


@admin.register(DrmKasyoDedup)
class DrmKasyoDedupAdmin(admin.ModelAdmin):
    list_display = ("pref_code", "join_key_csv", "road_name", "length_km_csv")
    list_filter = ("pref_code",)
    search_fields = ("join_key_csv", "road_name")


@admin.register(DrmLinks)
class DrmLinksAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "pref_code",
        "join_key",
        "matchcode_shp",
        "section_code_csv",
        "road_name",
        "length_m",
        "traffic24_total",
    )
    list_filter = ("pref_code", "updown_cd", "toll_cd")
    search_fields = ("join_key", "matchcode_shp", "road_name")


@admin.register(DrmLinksVerticesPgr)
class DrmLinksVerticesPgrAdmin(admin.ModelAdmin):
    list_display = ("id", "the_geom")
    search_fields = ("id",)


# --- Car routing & segments ---


@admin.register(CarRouting)
class CarRoutingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "route_id",
        "shape_id",
        "direction_id",
        "service_id",
        "status",
    )
    list_filter = ("status", "service_id")
    search_fields = ("route_id", "shape_id", "simulation__name")
    raw_id_fields = ("simulation", "simulation_input")


@admin.register(CarRoutingSegment)
class CarRoutingSegmentAdmin(admin.ModelAdmin):
    list_display = ("id", "car_routing", "seq", "link_id", "section_id", "road_name")
    list_filter = ("section_id",)
    search_fields = ("road_name", "link_id")
    raw_id_fields = ("car_routing",)
    ordering = ("car_routing", "seq")


# --- Segment metrics / benefit / CO2 ---


@admin.register(SegmentSpeedMetrics)
class SegmentSpeedMetricsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "route_id",
        "shape_id",
        "service_id",
        "matchcode_shp",
        "speed_before_kmh",
        "speed_after_kmh",
    )
    list_filter = ("service_id",)
    search_fields = ("route_id", "shape_id", "matchcode_shp", "simulation__name")
    raw_id_fields = ("simulation", "simulation_input")


@admin.register(BenefitCalculations)
class BenefitCalculationsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "route_id",
        "shape_id",
        "service_id",
        "matchcode_shp",
        "travel_time_savings_before",
        "travel_time_savings_after",
    )
    list_filter = ("service_id",)
    search_fields = ("route_id", "shape_id", "matchcode_shp", "simulation__name")
    raw_id_fields = ("simulation", "simulation_input")


@admin.register(CO2Reduction)
class CO2ReductionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "route_id",
        "service_id",
        "vkt_before_km_day",
        "vkt_after_km_day",
        "delta_vkt_km_day",
        "co2_tons_per_year",
        "status",
    )
    list_filter = ("status", "service_id")
    search_fields = ("route_id", "simulation__name")
    raw_id_fields = ("simulation", "simulation_input")


# --- Validation result ---


@admin.register(SimulationValidationResult)
class SimulationValidationResultAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "simulation",
        "simulation_input",
        "service_date",
        "service_id",
        "status",
        "version",
        "is_latest",
        "updated_at",
    )
    list_filter = ("status", "is_latest")
    search_fields = ("simulation__name", "service_id", "service_date")
    raw_id_fields = ("simulation", "simulation_input")
    ordering = ("-updated_at",)
