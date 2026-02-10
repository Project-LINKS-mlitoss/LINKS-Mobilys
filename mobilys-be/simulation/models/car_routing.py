from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from simulation.constants.choices import STATUS_CHOICES
from simulation.models.simulation import Simulation, SimulationInput


class CarRouting(models.Model):
    simulation = models.ForeignKey(
        Simulation,
        on_delete=models.CASCADE,
        related_name="car_routings",
    )
    simulation_input = models.ForeignKey(
        SimulationInput,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="car_routings_by_input",
    )
    route_id = models.CharField(max_length=64, help_text="GTFS routes.route_id")
    shape_id = models.CharField(max_length=128, blank=True)
    direction_id = models.IntegerField(null=True, blank=True)
    service_id = models.CharField(max_length=128, default="平日")

    delta_demand_persons_day = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    car_share = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
    )

    start_lon = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    start_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    end_lon = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    end_lat = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default="draft",
        db_index=True,
    )

    class Meta:
        db_table = "car_routing"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["simulation", "route_id", "shape_id", "simulation_input", "service_id"],
                name="uniq_car_routing_sim_input_route",
            )
        ]
        indexes = [
            models.Index(
                fields=["simulation", "route_id", "shape_id"],
                name="car_routing_sim_r_shp_ip_idx",
            ),
            models.Index(fields=["simulation_input"], name="car_routing_siminput_idx"),
        ]

    def __str__(self) -> str:
        return f"CarRouting(sim={self.simulation_id}, route={self.route_id})"


class CarRoutingSegment(models.Model):
    car_routing = models.ForeignKey(
        CarRouting,
        on_delete=models.CASCADE,
        related_name="segments",
    )
    seq = models.PositiveIntegerField()
    link_id = models.BigIntegerField()
    section_id = models.CharField(max_length=64, null=True, blank=True)
    road_name = models.TextField(null=True, blank=True)

    length_m = models.IntegerField(null=True, blank=True)
    lanes = models.IntegerField(null=True, blank=True)
    speed_up_kmh = models.FloatField(null=True, blank=True)
    speed_dn_kmh = models.FloatField(null=True, blank=True)

    baseline_cars_per_day = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    delta_cars_per_day = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    after_cars_per_day = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)

    cost_min = models.FloatField(null=True, blank=True)
    geometry = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "car_routing_segment"
        ordering = ["car_routing", "seq"]
        constraints = [
            models.UniqueConstraint(
                fields=["car_routing", "seq"],
                name="uniq_car_routing_seg_seq",
            )
        ]
        indexes = [
            models.Index(fields=["car_routing", "seq"], name="car_routing_seg_idx"),
            models.Index(fields=["link_id"], name="car_routing_seg_link_idx"),
        ]

    def __str__(self) -> str:
        return (
            f"CarRoutingSeg(car_routing={self.car_routing_id}, seq={self.seq}, link={self.link_id})"
        )
