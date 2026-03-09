# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.db import models
import uuid
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class Role(models.Model):
    LEVEL_CHOICES = [
        ('super_user', 'Super User'),
        ('organizer', 'Organizer'),
        ('user', 'User'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role_name = models.CharField(max_length=100)
    level = models.CharField(max_length=50, choices=LEVEL_CHOICES)
    active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'role'
    
    def __str__(self):
        return f"{self.role_name} ({self.level})"


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization_name = models.CharField(max_length=200)
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='organized_organizations'
    )
    active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    section = models.CharField(max_length=200, blank=True, null=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'organization'
    
    def __str__(self):
        return self.organization_name


class UserDetail(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_detail'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_user_details'
    )
    created_date = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True, null=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_detail'
    
    def __str__(self):
        return f"{self.user.username} - {self.role.role_name if self.role else 'No Role'}"


class Access(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    access_name = models.CharField(max_length=100)
    access_code = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'access'
    
    def __str__(self):
        return f"{self.access_name} ({self.access_code})"


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200)
    active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'project'
    
    def __str__(self):
        return self.project_name


class ProjectUserMap(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='user_mappings'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_mappings'
    )
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'project_user_map'
        unique_together = (('project', 'user'),)
    
    def __str__(self):
        return f"{self.project.project_name} - {self.user.username}"


class RoleAccessMap(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='access_mappings'
    )
    access = models.ForeignKey(
        Access,
        on_delete=models.CASCADE,
        related_name='role_mappings'
    )
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'role_access_map'
        unique_together = (('role', 'access'),)
    
    def __str__(self):
        return f"{self.role.role_name} -> {self.access.access_name}"
