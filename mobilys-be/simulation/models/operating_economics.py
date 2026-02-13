# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from simulation.constants.choices import STATUS_CHOICES
from simulation.models.simulation import Simulation, SimulationInput


class OperatingEconomics(models.Model):
    simulation = models.ForeignKey(
        Simulation,
        on_delete=models.CASCADE,
        related_name="operating_economics",
    )
    simulation_input = models.ForeignKey(
        SimulationInput,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="operating_economics_by_input",
    )

    route_id = models.CharField(max_length=64, help_text="GTFS routes.route_id")
    service_id = models.CharField(max_length=128, default="平日")

    route_length_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )

    cost_per_vkm_yen = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=Decimal("520.90"),
    )
    fare_override_yen = models.PositiveIntegerField(null=True, blank=True)

    delta_vehicle_km_per_day = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    delta_cost_yen_per_day = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    delta_revenue_yen_per_day = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    net_per_day_yen = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    annual_benefit_k_yen = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "operating_economics"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["simulation", "route_id", "simulation_input", "service_id"],
                name="uniq_ops_sim_input_route",
            )
        ]
        indexes = [
            models.Index(fields=["simulation", "route_id"], name="ops_sim_route_input_idx"),
            models.Index(fields=["simulation_input"], name="ops_siminput_idx"),
        ]

    def __str__(self) -> str:
        return f"Ops(sim={self.simulation_id}, route={self.route_id})"
