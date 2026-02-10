import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class Transfers(models.Model):

    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    from_stop_id = models.CharField(max_length=200)
    to_stop_id = models.CharField(max_length=200)
    transfer_type = models.IntegerField(
        help_text="0=Recommended, 1=Timed, 2=Minimum time, 3=Not possible"
    )
    min_transfer_time = models.IntegerField(
        null=True,
        blank=True,
        help_text="Minimum transfer time in seconds"
    )

    # Global GTFS extra fields (optional)
    from_route_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional: route_id from routes.txt"
    )
    to_route_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional: route_id from routes.txt"
    )
    from_trip_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional: trip_id from trips.txt"
    )
    to_trip_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional: trip_id from trips.txt"
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transfers"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "scenario",
                    "from_stop_id",
                    "to_stop_id",
                    "from_route_id",
                    "to_route_id",
                    "from_trip_id",
                    "to_trip_id",
                ],
                name="unique_transfer_rule_per_scenario",
            )
        ]

    def __str__(self):
        base = f"{self.from_stop_id} -> {self.to_stop_id}"
        if self.from_route_id or self.from_trip_id:
            base += f" (from {self.from_route_id or self.from_trip_id})"
        if self.to_route_id or self.to_trip_id:
            base += f" (to {self.to_route_id or self.to_trip_id})"
        return base
