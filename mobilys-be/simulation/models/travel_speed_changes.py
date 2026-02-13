# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from simulation.models.simulation import Simulation, SimulationInput


class SegmentSpeedMetrics(models.Model):
    simulation = models.ForeignKey(
        Simulation,
        on_delete=models.CASCADE,
        related_name="segment_speed_metrics",
        db_index=True,
    )
    simulation_input = models.ForeignKey(
        SimulationInput,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="segment_speed_metrics_by_input",
    )
    route_id = models.CharField(max_length=128, db_index=True)
    shape_id = models.CharField(max_length=128, db_index=True)
    direction_id = models.IntegerField(null=True, blank=True)
    service_id = models.CharField(max_length=128, default="平日")
    matchcode_shp = models.TextField(db_index=True)
    section_code_csv = models.CharField(max_length=64, null=True, blank=True)
    road_name = models.TextField(null=True, blank=True)

    speed_before_kmh = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        validators=[MinValueValidator(Decimal("0"))],
    )
    speed_after_kmh = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        validators=[MinValueValidator(Decimal("0"))],
    )

    time_per_vehicle_before_h = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0"))],
    )
    time_per_vehicle_after_h = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0"))],
    )

    total_time_before_vehicle_h = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    total_time_after_vehicle_h = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "segment_speed_metrics"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["simulation", "route_id", "shape_id"], name="segm_sim_route_shape_idx"),
            models.Index(fields=["matchcode_shp"], name="segm_matchcode_idx"),
            models.Index(fields=["simulation_input"], name="segm_siminput_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "simulation",
                    "route_id",
                    "shape_id",
                    "matchcode_shp",
                    "simulation_input",
                    "service_id",
                ],
                name="uniq_segm_metrics_sim_input_route_shape_match",
            )
        ]

    def __str__(self) -> str:
        return (
            f"SegMetrics(sim={self.simulation_id}, route={self.route_id}, "
            f"shape={self.shape_id}, code={self.matchcode_shp})"
        )

