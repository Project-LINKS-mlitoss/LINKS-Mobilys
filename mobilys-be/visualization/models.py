# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid
from django.contrib.gis.db import models
from django.contrib.auth import get_user_model
from user.models import Project


class PoiBatch(models.Model):
    class Meta:
        db_table = "poi_batches"
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "file_name"]),  
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project", "file_name"],
                name="uniq_poi_batch_filename_per_user_project",
            ),
        ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name="poi_batches")
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="poi_batches",
        null=True,
        blank=True,
        db_index=True,
    )
    file_name = models.CharField(max_length=255)  
    remark = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)



class PointOfInterests(models.Model):
    class Meta:
        db_table = 'point_of_interests'
        indexes = [
            models.Index(fields=["user", "type"]),
            models.Index(fields=["user", "batch"]),  
            models.Index(fields=["project", "type"]),
            models.Index(fields=["project", "batch"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project", "batch", "type", "name", "lat", "lng"],
                name="uniq_poi_user_project_batch_type_name_lat_lng",
            ),
        ]

    user = models.ForeignKey(
        get_user_model(),
        on_delete=models.CASCADE,
        related_name='pois'
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='pois',
        null=True,
        blank=True,
        db_index=True,
    )
    batch = models.ForeignKey(
        PoiBatch,
        on_delete=models.CASCADE,
        related_name='pois',
        null=True, blank=True,
        db_index=True,
    )

    type = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=255)
    lat = models.CharField(max_length=15)
    lng = models.CharField(max_length=15)
    remark = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} ({self.type})"


class PopulationMesh(models.Model):
    meshcode = models.CharField(max_length=12, unique=True)
    mcode = models.CharField(max_length=5)  # e.g., 'M5537'
    age_0_14 = models.IntegerField(null=True, blank=True)
    age_15_64 = models.IntegerField(null=True, blank=True)
    age_65_up = models.IntegerField(null=True, blank=True)
    total = models.IntegerField(null=True, blank=True)
    geom = models.PolygonField(srid=6668)


    class Meta:
        db_table = 'population_mesh'
        verbose_name = 'Population Mesh'
        verbose_name_plural = 'Population Meshes'

    def __str__(self):
        return f"Mesh {self.meshcode}"

class MeshLocation(models.Model):
    meshcode = models.CharField(max_length=12, unique=True)
    mcode = models.CharField(max_length=5)  # e.g., 'M5537'
    prefecture_name = models.CharField(max_length=100)
    city_name = models.CharField(max_length=100)
    city_code = models.CharField(max_length=100)

    class Meta:
        db_table = 'mesh_location'
        ordering = ['id'] 

    def __str__(self):
        return f"{self.prefecture_name} - {self.city_name} ({self.meshcode})"


class ProjectPrefectureSelection(models.Model):
    class Meta:
        db_table = "project_prefecture_selections"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name="prefecture_selection",
    )
    prefecture_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        suffix = self.prefecture_name or "default"
        return f"{self.project_id}: {suffix}"


class UserPrefectureSelection(models.Model):
    class Meta:
        db_table = "user_prefecture_selections"
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                name="uniq_user_prefecture_selection",
            ),
        ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        get_user_model(),
        on_delete=models.CASCADE,
        related_name="user_prefecture_selection",
    )
    prefecture_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        suffix = self.prefecture_name or "default"
        return f"{self.user_id}: {suffix}"
