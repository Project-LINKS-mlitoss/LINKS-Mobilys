# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.contrib import admin
from .models import Role, Organization, UserDetail, Access, Project, ProjectUserMap, RoleAccessMap


class RoleAccessMapInline(admin.TabularInline):
    model = RoleAccessMap
    extra = 1
    autocomplete_fields = ['access']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('role_name', 'level', 'active', 'created_datetime', 'updated_datetime')
    list_filter = ('level', 'active', 'created_datetime')
    search_fields = ('role_name', 'description')
    readonly_fields = ('id', 'created_datetime', 'updated_datetime')
    inlines = [RoleAccessMapInline]
    
    fieldsets = (
        (None, {
            'fields': ('id', 'role_name', 'level', 'active')
        }),
        ('Details', {
            'fields': ('description',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_datetime', 'updated_datetime'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('organization_name', 'organizer', 'section', 'active', 'created_datetime')
    list_filter = ('active', 'created_datetime')
    search_fields = ('organization_name', 'section', 'description', 'organizer__username')
    readonly_fields = ('id', 'created_datetime', 'updated_datetime')
    autocomplete_fields = ['organizer']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'organization_name', 'organizer', 'section', 'active')
        }),
        ('Details', {
            'fields': ('description',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_datetime', 'updated_datetime'),
            'classes': ('collapse',)
        }),
    )


@admin.register(UserDetail)
class UserDetailAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'organization', 'created_by', 'created_date')
    list_filter = ('role', 'organization', 'created_date')
    search_fields = ('user__username', 'user__email', 'role__role_name', 'organization__organization_name')
    readonly_fields = ('id', 'created_date', 'updated_datetime')
    autocomplete_fields = ['user', 'role', 'organization', 'created_by']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'user', 'role', 'organization')
        }),
        ('Audit', {
            'fields': ('created_by', 'description'),
        }),
        ('Timestamps', {
            'fields': ('created_date', 'updated_datetime'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Access)
class AccessAdmin(admin.ModelAdmin):
    list_display = ('access_name', 'access_code', 'created_datetime', 'updated_datetime')
    search_fields = ('access_name', 'access_code', 'description')
    readonly_fields = ('id', 'created_datetime', 'updated_datetime')
    
    fieldsets = (
        (None, {
            'fields': ('id', 'access_name', 'access_code')
        }),
        ('Details', {
            'fields': ('description',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_datetime', 'updated_datetime'),
            'classes': ('collapse',)
        }),
    )


class ProjectUserMapInline(admin.TabularInline):
    model = ProjectUserMap
    extra = 1
    autocomplete_fields = ['user']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('project_name', 'active', 'created_datetime', 'updated_datetime')
    list_filter = ('active', 'created_datetime')
    search_fields = ('project_name', 'description')
    readonly_fields = ('id', 'created_datetime', 'updated_datetime')
    inlines = [ProjectUserMapInline]
    
    fieldsets = (
        (None, {
            'fields': ('id', 'project_name', 'active')
        }),
        ('Details', {
            'fields': ('description',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_datetime', 'updated_datetime'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ProjectUserMap)
class ProjectUserMapAdmin(admin.ModelAdmin):
    list_display = ('project', 'user', 'created_datetime')
    list_filter = ('project', 'created_datetime')
    search_fields = ('project__project_name', 'user__username')
    readonly_fields = ('id', 'created_datetime', 'updated_datetime')
    autocomplete_fields = ['project', 'user']


@admin.register(RoleAccessMap)
class RoleAccessMapAdmin(admin.ModelAdmin):
    list_display = ('role', 'access', 'created_datetime')
    list_filter = ('role', 'access', 'created_datetime')
    search_fields = ('role__role_name', 'access__access_name', 'access__access_code')
    readonly_fields = ('id', 'created_datetime', 'updated_datetime')
    autocomplete_fields = ['role', 'access']