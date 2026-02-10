from django.db import models

from simulation.constants.choices import STATUS_CHOICES
from simulation.models.simulation import Simulation, SimulationInput


class CO2Reduction(models.Model):
    simulation = models.ForeignKey(
        Simulation,
        on_delete=models.CASCADE,
        related_name="co2_reductions",
    )
    simulation_input = models.ForeignKey(
        SimulationInput,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="co2_reductions_by_input",
    )

    route_id = models.CharField(
        max_length=64,
        help_text="GTFS routes.route_id",
        db_index=True,
    )
    service_id = models.CharField(max_length=128, default="平日")

    vkt_before_km_day = models.DecimalField(max_digits=20, decimal_places=3, null=True, blank=True)
    vkt_after_km_day = models.DecimalField(max_digits=20, decimal_places=3, null=True, blank=True)
    delta_vkt_km_day = models.DecimalField(max_digits=20, decimal_places=3, null=True, blank=True)

    ef_car_g_per_vkm = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)

    co2_tons_per_year = models.DecimalField(max_digits=20, decimal_places=3, null=True, blank=True)

    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "co2_reduction"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["simulation", "simulation_input", "route_id", "service_id"],
                name="uniq_co2_sim_input_route",
            )
        ]
        indexes = [
            models.Index(fields=["simulation", "route_id"], name="co2_sim_route_idx"),
            models.Index(fields=["simulation_input"], name="co2_siminput_idx"),
        ]

    def __str__(self) -> str:
        return (
            f"CO2(sim={self.simulation_id}, input={self.simulation_input_id}, route={self.route_id})"
        )
