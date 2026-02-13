# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import hashlib

from django.db import models

from simulation.constants.choices import VALIDATION_STATUS


def validation_upload_to(instance, filename):
    return f"simulations/{instance.simulation_id}/validation/{filename}"


class SimulationValidationResult(models.Model):
    simulation = models.ForeignKey(
        "Simulation",
        on_delete=models.CASCADE,
        related_name="validation_results",
    )
    simulation_input = models.ForeignKey(
        "SimulationInput",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="validation_results",
    )

    uploaded_file = models.FileField(upload_to=validation_upload_to, null=True, blank=True)
    file_name = models.CharField(max_length=255, blank=True, default="")
    file_size = models.BigIntegerField(null=True, blank=True)
    file_sha256 = models.CharField(max_length=64, blank=True, default="")

    service_date = models.CharField(max_length=10, blank=True, default="")
    service_id = models.CharField(max_length=128, blank=True, default="")
    service_ids = models.JSONField(default=list)

    result_json = models.JSONField(default=dict)
    summary_counts = models.JSONField(default=dict)

    status = models.CharField(
        max_length=16,
        choices=VALIDATION_STATUS,
        default="ok",
        db_index=True,
    )

    version = models.PositiveIntegerField(default=1)
    is_latest = models.BooleanField(default=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "simulation_validation_result"
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["simulation", "version"], name="uniq_validation_sim_version"),
        ]
        indexes = [
            models.Index(fields=["simulation", "is_latest"], name="validation_sim_latest_idx"),
            models.Index(fields=["simulation_input"], name="validation_siminput_idx"),
        ]

    def __str__(self):
        return f"Validation(sim={self.simulation_id}, ver={self.version}, latest={self.is_latest})"

    def set_file_meta(self, fobj):
        if not fobj:
            return
        self.file_name = getattr(fobj, "name", "") or self.file_name
        self.file_size = getattr(fobj, "size", None)
        try:
            pos = fobj.tell()
            fobj.seek(0)
            h = hashlib.sha256()
            for chunk in iter(lambda: fobj.read(1024 * 1024), b""):
                h.update(chunk)
            self.file_sha256 = h.hexdigest()
            fobj.seek(pos)
        except Exception:
            pass
