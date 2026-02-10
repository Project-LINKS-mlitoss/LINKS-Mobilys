import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class FareAttribute(models.Model):
    scenario          = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    agency_id         = models.CharField(max_length=200, null=True, blank=True)
    fare_id           = models.CharField(max_length=200)
    price             = models.DecimalField(max_digits=10, decimal_places=2)
    currency_type     = models.CharField(max_length=10)
    payment_method    = models.IntegerField(null=True, blank=True,
                          help_text="0 = paid on board, 1 = paid before boarding, or your own codes")
    transfers         = models.IntegerField(null=True, blank=True,
                          help_text="Number of permitted transfers, if any")
    transfer_duration = models.IntegerField(null=True, blank=True,
                          help_text="Seconds allowed for transfer window")
    created_datetime  = models.DateTimeField(auto_now_add=True)
    updated_datetime  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fare_attributes'

    def __str__(self):
        return f"{self.agency_id}:{self.fare_id} – {self.price} {self.currency_type}"

class FareRule(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    fare_attribute = models.ForeignKey(FareAttribute, on_delete=models.CASCADE, related_name='rules')
    fare_id = models.CharField(max_length=200)

    route_id = models.CharField(max_length=200, blank=True)
    origin_id = models.CharField(max_length=200, blank=True)
    destination_id = models.CharField(max_length=200, blank=True)
    contains_id = models.CharField(max_length=200, blank=True)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fare_rules'

    def __str__(self):
        parts = [self.route_id or '*', self.origin_id or '*', self.destination_id or '*']
        return f"Rule {self.fare_id}: {' / '.join(parts)}"

class FareLegRule(models.Model):
    """
    fare_leg_rules.txt

    Fare rules for individual legs of travel.
    Spec PK: (network_id, from_area_id, to_area_id,
              from_timeframe_group_id, to_timeframe_group_id,
              fare_product_id)
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    leg_group_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="Groups entries for transfer rules",
    )

    network_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="routes.network_id or networks.network_id",
    )
    from_area_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="areas.area_id",
    )
    to_area_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="areas.area_id",
    )

    from_timeframe_group_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="timeframes.timeframe_group_id",
    )
    to_timeframe_group_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="timeframes.timeframe_group_id",
    )

    fare_product_id = models.CharField(
        max_length=200,
        help_text="fare_products.fare_product_id",
    )

    rule_priority = models.IntegerField(
        null=True,
        blank=True,
        help_text="Higher values = higher priority. Empty treated as 0.",
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fare_leg_rules"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "scenario",
                    "network_id",
                    "from_area_id",
                    "to_area_id",
                    "from_timeframe_group_id",
                    "to_timeframe_group_id",
                    "fare_product_id",
                ],
                name="unique_fare_leg_rule_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.fare_product_id} ({self.from_area_id}->{self.to_area_id})"

class FareLegJoinRule(models.Model):
    """
    fare_leg_join_rules.txt

    Joins two legs into a single effective fare leg.
    Spec PK: (from_network_id, to_network_id, from_stop_id, to_stop_id)
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    from_network_id = models.CharField(
        max_length=200,
        help_text="routes.network_id or networks.network_id",
    )
    to_network_id = models.CharField(
        max_length=200,
        help_text="routes.network_id or networks.network_id",
    )

    from_stop_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="stops.stop_id",
    )
    to_stop_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="stops.stop_id",
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fare_leg_join_rules"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "scenario",
                    "from_network_id",
                    "to_network_id",
                    "from_stop_id",
                    "to_stop_id",
                ],
                name="unique_fare_leg_join_rule_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.from_network_id}->{self.to_network_id} ({self.from_stop_id}->{self.to_stop_id})"

class FareTransferRule(models.Model):
    """
    fare_transfer_rules.txt

    Fare rules for transfers between legs.
    Spec PK: (from_leg_group_id, to_leg_group_id,
              fare_product_id, transfer_count, duration_limit)
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    from_leg_group_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="fare_leg_rules.leg_group_id (pre-transfer)",
    )
    to_leg_group_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="fare_leg_rules.leg_group_id (post-transfer)",
    )

    transfer_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="-1 = unlimited, >=1 = max consecutive transfers",
    )

    duration_limit = models.IntegerField(
        null=True,
        blank=True,
        help_text="Seconds; empty means no limit",
    )
    duration_limit_type = models.IntegerField(
        null=True,
        blank=True,
        help_text="0–3, defines how duration_limit is measured",
    )

    fare_transfer_type = models.IntegerField(
        help_text="0=A+AB, 1=A+AB+B, 2=AB",
    )

    fare_product_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="fare_products.fare_product_id (transfer product)",
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fare_transfer_rules"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "scenario",
                    "from_leg_group_id",
                    "to_leg_group_id",
                    "fare_product_id",
                    "transfer_count",
                    "duration_limit",
                ],
                name="unique_fare_transfer_rule_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.from_leg_group_id}->{self.to_leg_group_id}"
