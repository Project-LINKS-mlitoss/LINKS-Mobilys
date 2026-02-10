import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class Area(models.Model):
    """
    areas.txt

    Defines area identifiers.
    Spec fields: area_id, area_name
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    area_id = models.CharField(max_length=200)
    area_name = models.CharField(max_length=200, blank=True)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "areas"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "area_id"],
                name="unique_area_per_scenario",
            )
        ]

    def __str__(self):
        return self.area_name or self.area_id

class StopArea(models.Model):
    """
    stop_areas.txt

    Assigns stops to areas.
    Spec fields: area_id, stop_id
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    area_id = models.CharField(
        max_length=200,
        help_text="areas.area_id",
    )
    stop_id = models.CharField(
        max_length=200,
        help_text="stops.stop_id",
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "stop_areas"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "area_id", "stop_id"],
                name="unique_stop_area_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.area_id} -> {self.stop_id}"

class Network(models.Model):
    """
    networks.txt

    Network grouping of routes (for fares v2).
    Spec fields: network_id, network_name
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    network_id = models.CharField(max_length=200)
    network_name = models.CharField(max_length=200, blank=True)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "networks"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "network_id"],
                name="unique_network_per_scenario",
            )
        ]

    def __str__(self):
        return self.network_name or self.network_id

class RouteNetwork(models.Model):
    """
    route_networks.txt

    Assigns routes to networks.
    Spec fields: network_id, route_id
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    network_id = models.CharField(
        max_length=200,
        help_text="networks.network_id",
    )
    route_id = models.CharField(
        max_length=200,
        help_text="routes.route_id",
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "route_networks"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "route_id"],
                name="unique_route_network_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.route_id} -> {self.network_id}"
