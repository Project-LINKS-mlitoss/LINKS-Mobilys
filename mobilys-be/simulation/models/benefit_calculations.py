# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from simulation.models.simulation import Simulation, SimulationInput


class BenefitCalculations(models.Model):
    simulation = models.ForeignKey(
        Simulation,
        on_delete=models.CASCADE,
        related_name="benefit_calculations",
        db_index=True,
    )
    simulation_input = models.ForeignKey(
        SimulationInput,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="benefit_calculations_by_input",
    )

    route_id = models.CharField(max_length=128, db_index=True)
    shape_id = models.CharField(max_length=128, db_index=True)
    direction_id = models.IntegerField(null=True, blank=True)
    service_id = models.CharField(max_length=128, default="平日")
    matchcode_shp = models.TextField(db_index=True)
    section_code_csv = models.CharField(max_length=64, null=True, blank=True)
    road_name = models.TextField(null=True, blank=True)

    travel_time_savings_before = models.DecimalField(
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    travel_time_savings_after = models.DecimalField(
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    operating_cost_reduction_before = models.DecimalField(
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    operating_cost_reduction_after = models.DecimalField(
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    traffic_accident_reduction_before = models.DecimalField(
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    traffic_accident_reduction_after = models.DecimalField(
        max_digits=16,
        decimal_places=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "benefit_calculations"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["simulation", "route_id", "shape_id"], name="benefit_sim_route_shape_idx"),
            models.Index(fields=["matchcode_shp"], name="benefit_matchcode_idx"),
            models.Index(fields=["simulation_input"], name="benefit_siminput_idx"),
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
                name="uniq_benefit_sim_input_route_shape_match",
            )
        ]

    def __str__(self) -> str:
        return (
            f"Benefit(sim={self.simulation_id}, route={self.route_id}, "
            f"shape={self.shape_id}, code={self.matchcode_shp})"
        )

