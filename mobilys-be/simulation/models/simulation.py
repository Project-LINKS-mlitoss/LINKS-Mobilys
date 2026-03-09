# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.conf import settings
from django.db import models

from gtfs.models import Scenario

from simulation.constants.choices import STATUS_CHOICES


class Simulation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="simulations",
        null=False,
        blank=False,
    )

    scenario = models.ForeignKey(
        Scenario,
        on_delete=models.CASCADE,
        related_name="simulations",
        null=True,
        blank=True,
    )

    original_scenario = models.ForeignKey(
        Scenario,
        on_delete=models.CASCADE,
        related_name="original_simulations",
    )
    duplicated_scenario = models.ForeignKey(
        Scenario,
        on_delete=models.CASCADE,
        related_name="duplicated_simulations",
    )
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")

    class Meta:
        db_table = "simulation"
        ordering = ["id"]
        indexes = [
            # legacy index for Block 2 code
            models.Index(fields=["scenario", "id"], name="sim_scn_id_idx"),
            models.Index(fields=["original_scenario", "id"], name="sim_orig_scn_id_idx"),
            models.Index(fields=["duplicated_scenario", "id"], name="sim_dupl_scn_id_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_simulation_name_per_user",
            )
        ]

    def save(self, *args, **kwargs):
        # Keep alias in sync: Block 2 reads `scenario`; we mirror `original_scenario`
        if self.original_scenario_id and self.scenario_id != self.original_scenario_id:
            self.scenario_id = self.original_scenario_id
        super().save(*args, **kwargs)


class SimulationInput(models.Model):
    simulation = models.ForeignKey(
        "simulation.Simulation",
        on_delete=models.CASCADE,
        related_name="inputs",
        db_index=True,
    )

    service_date = models.DateField()
    service_id = models.CharField(max_length=128)

    sensitivity_up = models.FloatField()  # epsilon_inc
    sensitivity_down = models.FloatField()  # epsilon_dec
    trip_cost = models.FloatField()  # costPerVehKmYen
    car_share = models.FloatField()  # carShare
    time_value_yen_per_min_per_vehicle = models.FloatField()  # timeValueYenPerMin_perVehicle
    default_fare = models.FloatField(null=True, blank=True)  # defaultFare

    source_file_name = models.CharField(max_length=255, blank=True)
    source_file_size = models.BigIntegerField(default=0)
    source_file_type = models.CharField(max_length=100, blank=True)

    ic_agg = models.JSONField(null=True, blank=True)

    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default="success",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "simulation_input"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["simulation"], name="sim_input_sim_idx"),
            models.Index(fields=["service_date", "simulation"], name="sim_input_date_sim_idx"),
        ]

    def __str__(self) -> str:
        return f"SimulationInput#{self.pk} for Simulation#{self.simulation_id}"
