# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
# gtfs/admin.py

from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import (
    Scenario,
    Agency,
    Stops,
    StopNameKeywords,
    StopNameKeywordMap,
    StopIdKeyword,
    StopIdKeywordMap,
    Routes,
    Shape,
    Trips,
    StopTimes,
    Calendar,
    CalendarDates,
    RouteKeywords,
    RouteKeywordMap,
    FeedInfo,
    Translation,
    Map,
    Profile,
    Notification,
    FareAttribute,
    FareRule,
    GtfsValidationResult,
)

User = get_user_model()


@admin.register(Scenario)
class ScenarioAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "scenario_name",
        "source_type",
        "created_datetime",
        "osm_graph_status",
        "drm_graph_status",
        "deletion_state",
        "edit_state",
    )
    list_filter = (
        "source_type",
        "osm_graph_status",
        "drm_graph_status",
        "deletion_state",
        "edit_state",
    )
    search_fields = ("scenario_name", "user__username", "user__email")
    raw_id_fields = ("user", "source_scenario")
    ordering = ("-created_datetime",)


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display = ("id", "agency_id", "agency_name", "scenario", "created_datetime")
    list_filter = ("scenario",)
    search_fields = ("agency_id", "agency_name", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(Stops)
class StopsAdmin(admin.ModelAdmin):
    list_display = ("id", "stop_id", "stop_name", "scenario", "stop_lat", "stop_lon")
    list_filter = ("scenario",)
    search_fields = ("stop_id", "stop_name", "scenario__scenario_name")
    raw_id_fields = ("scenario",)
    ordering = ("stop_id",)


@admin.register(StopNameKeywords)
class StopNameKeywordsAdmin(admin.ModelAdmin):
    list_display = ("stop_group_id", "stop_name_keyword", "stop_group_id_label", "scenario")
    list_filter = ("scenario",)
    search_fields = ("stop_name_keyword", "stop_group_id_label", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(StopNameKeywordMap)
class StopNameKeywordMapAdmin(admin.ModelAdmin):
    list_display = ("id", "stop_id", "stop_name_group_id", "scenario", "can_automatically_update")
    list_filter = ("scenario", "can_automatically_update")
    search_fields = ("stop_id", "stop_name_group_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(StopIdKeyword)
class StopIdKeywordAdmin(admin.ModelAdmin):
    list_display = ("stop_group_id", "stop_id_keyword", "stop_group_name_label", "scenario")
    list_filter = ("scenario",)
    search_fields = ("stop_id_keyword", "stop_group_name_label", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(StopIdKeywordMap)
class StopIdKeywordMapAdmin(admin.ModelAdmin):
    list_display = ("id", "stop_id_group_id", "stop_id", "scenario", "can_automatically_update")
    list_filter = ("scenario", "can_automatically_update")
    search_fields = ("stop_id", "stop_id_group_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(Routes)
class RoutesAdmin(admin.ModelAdmin):
    list_display = ("id", "route_id", "route_short_name", "route_long_name", "route_type", "scenario")
    list_filter = ("scenario", "route_type")
    search_fields = ("route_id", "route_short_name", "route_long_name", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(Shape)
class ShapeAdmin(admin.ModelAdmin):
    list_display = ("id", "shape_id", "shape_pt_sequence", "shape_pt_lat", "shape_pt_lon", "scenario")
    list_filter = ("scenario",)
    search_fields = ("shape_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)
    ordering = ("shape_id", "shape_pt_sequence")


@admin.register(Trips)
class TripsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "trip_id",
        "route_id",
        "service_id",
        "direction_id",
        "shape_id",
        "scenario",
        "is_direction_id_generated",
    )
    list_filter = ("scenario", "direction_id", "is_direction_id_generated")
    search_fields = ("trip_id", "route_id", "service_id", "shape_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(StopTimes)
class StopTimesAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "trip_id",
        "stop_id",
        "stop_sequence",
        "arrival_time",
        "departure_time",
        "scenario",
    )
    list_filter = ("scenario", "timepoint")
    search_fields = ("trip_id", "stop_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)
    ordering = ("trip_id", "stop_sequence")


@admin.register(Calendar)
class CalendarAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "service_id",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
        "start_date",
        "end_date",
        "scenario",
    )
    list_filter = ("scenario", "monday", "saturday", "sunday")
    search_fields = ("service_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(CalendarDates)
class CalendarDatesAdmin(admin.ModelAdmin):
    list_display = ("id", "service_id", "date", "exception_type", "scenario")
    list_filter = ("scenario", "exception_type", "date")
    search_fields = ("service_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(RouteKeywords)
class RouteKeywordsAdmin(admin.ModelAdmin):
    list_display = ("id", "keyword", "scenario", "keyword_color")
    list_filter = ("scenario",)
    search_fields = ("keyword", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(RouteKeywordMap)
class RouteKeywordMapAdmin(admin.ModelAdmin):
    list_display = ("id", "scenario", "route_id", "keyword", "can_automatically_update")
    list_filter = ("scenario", "can_automatically_update")
    search_fields = ("route_id", "keyword__keyword", "scenario__scenario_name")
    raw_id_fields = ("scenario", "keyword")


@admin.register(FeedInfo)
class FeedInfoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scenario",
        "feed_publisher_name",
        "feed_lang",
        "feed_start_date",
        "feed_end_date",
        "feed_version",
    )
    list_filter = ("scenario", "feed_lang")
    search_fields = ("feed_publisher_name", "feed_version", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scenario",
        "table_name",
        "field_name",
        "language",
        "route_id",
        "trip_id",
        "service_id",
        "stop_id",
        "shape_id",
        "feed_info_id",
    )
    list_filter = ("scenario", "table_name", "field_name", "language")
    search_fields = (
        "table_name",
        "field_name",
        "language",
        "route_id",
        "trip_id",
        "service_id",
        "stop_id",
        "shape_id",
        "feed_info_id",
        "scenario__scenario_name",
    )
    raw_id_fields = ("scenario",)


@admin.register(Map)
class MapAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "url")
    search_fields = ("name", "url")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "map")
    search_fields = ("user__username", "user__email", "map__name")
    raw_id_fields = ("user", "map")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "message",
        "scenario_id",
        "screen_menu",
        "is_read",
        "created_at",
    )
    list_filter = ("is_read", "screen_menu")
    search_fields = ("user__username", "user__email", "message", "scenario_id", "screen_menu")
    raw_id_fields = ("user",)
    ordering = ("-created_at",)


@admin.register(FareAttribute)
class FareAttributeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scenario",
        "agency_id",
        "fare_id",
        "price",
        "currency_type",
        "payment_method",
        "transfers",
        "transfer_duration",
    )
    list_filter = ("scenario", "currency_type", "payment_method")
    search_fields = ("fare_id", "agency_id", "scenario__scenario_name")
    raw_id_fields = ("scenario",)


@admin.register(FareRule)
class FareRuleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scenario",
        "fare_attribute",
        "route_id",
        "origin_id",
        "destination_id",
    )
    list_filter = ("scenario",)
    search_fields = (
        "fare_attribute__fare_id",
        "route_id",
        "origin_id",
        "destination_id",
        "scenario__scenario_name",
    )
    raw_id_fields = ("scenario", "fare_attribute")


@admin.register(GtfsValidationResult)
class GtfsValidationResultAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "scenario",
        "validator_version",
        "validated_at",
    )
    list_filter = ("validator_version",)
    search_fields = ("scenario__scenario_name", "validator_version")
    raw_id_fields = ("scenario",)
    ordering = ("-validated_at",)
