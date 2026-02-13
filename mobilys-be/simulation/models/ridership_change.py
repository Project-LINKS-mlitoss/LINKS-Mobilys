# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from simulation.constants.choices import DAY_CHOICES, STATUS_CHOICES
from simulation.models.simulation import Simulation, SimulationInput


class RidershipChange(models.Model):
    simulation = models.ForeignKey(
        Simulation,
        on_delete=models.CASCADE,
        related_name="ridership_changes",
    )
    simulation_input = models.ForeignKey(
        SimulationInput,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ridership_changes_by_input",
    )
    route_id = models.CharField(max_length=64, help_text="GTFS routes.route_id")
    day_type = models.CharField(
        max_length=16,
        choices=DAY_CHOICES,
        default="weekday",
        db_index=True,
    )

    baseline_riders_per_day = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="D0 (IC riders/day)",
    )

    baseline_trips_per_day = models.DecimalField(
        max_digits=9,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="B0 (trips/day)",
    )

    delta_trips_per_day = models.DecimalField(
        max_digits=9,
        decimal_places=2,
        help_text="ΔB (change in trips/day)",
    )

    sensitivity_epsilon = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="ε (sensitivity factor)",
    )

    delta_riders_per_day = models.IntegerField(
        null=True,
        blank=True,
        help_text="ΔD (change in riders/day, computed)",
    )

    gtfs_service_id = models.CharField(max_length=64, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    calc_meta = models.JSONField(null=True, blank=True)

    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ridership_change"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "simulation",
                    "route_id",
                    "day_type",
                    "simulation_input",
                    "gtfs_service_id",
                ],
                name="uniq_rc_sim_input_route_day",
            )
        ]
        indexes = [
            models.Index(
                fields=["simulation", "route_id", "day_type"],
                name="ridership_sim_route_day_idx",
            ),
            models.Index(fields=["simulation_input"], name="ridership_siminput_idx"),
        ]

    def __str__(self) -> str:
        return f"RC(sim={self.simulation_id}, route={self.route_id}, day={self.day_type})"
