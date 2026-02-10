import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from gtfs.constants import IsDefaultFareCategory
from .scenario import Scenario

class Timeframe(models.Model):
    """
    timeframes.txt

    Used for fares that vary by time-of-day / day-of-week.
    Spec fields: timeframe_group_id, start_time, end_time, service_id
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    timeframe_group_id = models.CharField(max_length=200)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    service_id = models.CharField(max_length=200)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "timeframes"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "scenario",
                    "timeframe_group_id",
                    "service_id",
                    "start_time",
                    "end_time",
                ],
                name="unique_timeframe_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.timeframe_group_id} ({self.service_id})"

class RiderCategory(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    rider_category_id = models.CharField(max_length=200)
    rider_category_name = models.CharField(max_length=200)

    is_default_fare_category = models.IntegerField(
        null=True,
        blank=True,
        choices=IsDefaultFareCategory.choices(),
        help_text="1 = default category, 0 or empty = not default",
    )

    eligibility_url = models.URLField(max_length=500, blank=True)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rider_categories"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "rider_category_id"],
                name="unique_rider_category_per_scenario",
            )
        ]

    def __str__(self):
        return self.rider_category_name

class FareMedia(models.Model):
    """
    fare_media.txt

    Describes fare media (paper ticket, card, app, etc.).
    Spec fields: fare_media_id, fare_media_name, fare_media_type
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    fare_media_id = models.CharField(max_length=200)
    fare_media_name = models.CharField(max_length=200, blank=True)
    fare_media_type = models.IntegerField(
        help_text=(
            "0=None, 1=Paper ticket, 2=Transit card, "
            "3=cEMV, 4=Mobile app"
        )
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fare_media"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "fare_media_id"],
                name="unique_fare_media_per_scenario",
            )
        ]

    def __str__(self):
        return self.fare_media_name or self.fare_media_id

class FareProduct(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    fare_product_id = models.CharField(max_length=200)
    fare_product_name = models.CharField(max_length=200, blank=True)

    rider_category_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="rider_categories.rider_category_id",
    )
    fare_media_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="fare_media.fare_media_id",
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(
        max_length=10,
        help_text="ISO 4217 currency code (e.g. JPY, USD)",
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fare_products"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "fare_product_id", "rider_category_id", "fare_media_id"],
                name="unique_fare_product_per_scenario",
            )
        ]

    def __str__(self):
        return self.fare_product_name or self.fare_product_id
