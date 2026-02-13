# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from gtfs.constants import ValidationSeverity
from .scenario import Scenario

class GtfsValidationResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scenario = models.OneToOneField(
        Scenario,
        on_delete=models.CASCADE,
        related_name='validation_result'
    )
    notices = models.JSONField(default=list)
    validated_at = models.DateTimeField(auto_now=True)
    validator_version = models.CharField(max_length=50, blank=True)
    
    class Meta:
        db_table = 'gtfs_validation_results'

    def __str__(self):
        return f"Validation for {self.scenario.scenario_name}"

class GtfsImportedFile(models.Model):
    """
    Tracks which GTFS files were present in an imported feed
    for a given Scenario.
    """
    scenario = models.ForeignKey(
        Scenario,
        on_delete=models.CASCADE,
        related_name="imported_files"
    )

    file_name = models.CharField(
        max_length=100,
        help_text="Standardized GTFS filename, e.g. stops.txt"
    )

    original_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Actual name in ZIP, in case it differs."
    )

    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gtfs_imported_files"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "file_name"],
                name="unique_gtfs_file_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.scenario_id}: {self.file_name}"

class GtfsImportedField(models.Model):
    """
    Tracks which columns were present in each imported GTFS file.
    Used when exporting to ensure only original columns are written.
    """
    gtfs_file = models.ForeignKey(
        GtfsImportedFile,
        on_delete=models.CASCADE,
        related_name="fields",
    )

    field_name = models.CharField(
        max_length=100,
        help_text="Column name, e.g. stop_id, route_short_name"
    )

    column_index = models.IntegerField(
        help_text="0-based index in the original file header."
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gtfs_imported_fields"
        constraints = [
            models.UniqueConstraint(
                fields=["gtfs_file", "field_name"],
                name="unique_field_per_file",
            )
        ]
        indexes = [
            models.Index(fields=["gtfs_file", "column_index"]),
        ]

    def __str__(self):
        return f"{self.gtfs_file.file_name}.{self.field_name} (idx={self.column_index})"

class GtfsSafeNoticeRule(models.Model):
    severity = models.CharField(
        max_length=10,
        choices=ValidationSeverity.choices()
    )
    code = models.CharField(max_length=200)

    reason_ja = models.TextField()
    reason_en = models.TextField()

    sample_conditions = models.JSONField(null=True, blank=True)

    allowed_filenames = ArrayField(
        base_field=models.CharField(max_length=255),
        default=list,
        blank=True,
    )

    skip = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_fixable = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "gtfs_safe_notice_rules"
        indexes = [
            models.Index(fields=["code", "is_active"]),
            models.Index(fields=["severity", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"[{self.severity}] {self.code} (active={self.is_active}, skip={self.skip})"
