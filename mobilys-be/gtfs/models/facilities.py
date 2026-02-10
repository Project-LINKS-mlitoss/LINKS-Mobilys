import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class Pathway(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    pathway_id = models.CharField(max_length=200)
    from_stop_id = models.CharField(max_length=200)
    to_stop_id = models.CharField(max_length=200)

    pathway_mode = models.IntegerField(
        help_text="1=walkway,2=stairs,3=travelator,4=escalator,5=elevator,6=fare gate,7=exit gate"
    )
    is_bidirectional = models.IntegerField(
        help_text="0=unidirectional, 1=bidirectional"
    )

    # Detailed / optional global fields
    length = models.FloatField(
        null=True, blank=True,
        help_text="Pathway length in meters"
    )
    traversal_time = models.IntegerField(
        null=True, blank=True,
        help_text="Estimated traversal time in seconds"
    )
    stair_count = models.IntegerField(
        null=True, blank=True,
        help_text="Number of stairs"
    )
    max_slope = models.FloatField(
        null=True, blank=True,
        help_text="Maximum slope (rise/run)"
    )
    min_width = models.FloatField(
        null=True, blank=True,
        help_text="Minimum width in meters"
    )
    signposted_as = models.CharField(
        max_length=200, blank=True,
        help_text="Signed direction towards this pathway"
    )
    reversed_signposted_as = models.CharField(
        max_length=200, blank=True,
        help_text="Signed direction when traversed in reverse"
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pathways"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "pathway_id"],
                name="unique_pathway_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.pathway_id}: {self.from_stop_id} -> {self.to_stop_id}"

class Level(models.Model):

    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    level_id = models.CharField(max_length=200)
    level_index = models.FloatField(
        help_text="0=ground, positive=above, negative=below"
    )
    level_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Human-readable level name"
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "levels"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "level_id"],
                name="unique_level_per_scenario",
            )
        ]

    def __str__(self):
        return self.level_id

class LocationGroup(models.Model):

    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    location_group_id = models.CharField(max_length=200)
    location_group_name = models.CharField(max_length=255)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "location_groups"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "location_group_id"],
                name="unique_location_group_per_scenario",
            )
        ]

    def __str__(self):
        return self.location_group_name

class LocationGroupStop(models.Model):

    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    location_group = models.ForeignKey(
        LocationGroup,
        on_delete=models.CASCADE,
        related_name="stops",
    )
    stop_id = models.CharField(max_length=200)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "location_group_stops"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "location_group", "stop_id"],
                name="unique_location_group_stop_per_scenario",
            )
        ]

    def __str__(self):
        return f"{self.location_group.location_group_id} -> {self.stop_id}"

class BookingRule(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    booking_rule_id = models.CharField(max_length=200)
    booking_type = models.IntegerField(
        help_text="0=real-time, 1=same-day with notice, 2=prior day(s)"
    )

    # Conditionally required / forbidden per spec
    prior_notice_duration_min = models.IntegerField(
        null=True, blank=True,
        help_text="Minutes before travel to make request (required when booking_type=1)."
    )
    prior_notice_duration_max = models.IntegerField(
        null=True, blank=True,
        help_text="Maximum minutes before travel for booking (optional for booking_type=1 only)."
    )
    prior_notice_last_day = models.IntegerField(
        null=True, blank=True,
        help_text="Last day before travel for booking (required when booking_type=2)."
    )
    prior_notice_last_time = models.TimeField(
        null=True, blank=True,
        help_text="Last time on the last day to book (required if prior_notice_last_day is set)."
    )
    prior_notice_start_day = models.IntegerField(
        null=True, blank=True,
        help_text="Earliest day before travel to book (for some type 2 cases)."
    )
    prior_notice_start_time = models.TimeField(
        null=True, blank=True,
        help_text="Earliest time on earliest booking day (required if prior_notice_start_day is set)."
    )
    prior_notice_service_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="calendar.service_id used for counting days, optional for booking_type=2 only."
    )

    message = models.TextField(
        blank=True,
        help_text="General booking message for this rule."
    )
    pickup_message = models.TextField(
        blank=True,
        help_text="Message for pickup-only scenarios."
    )
    drop_off_message = models.TextField(
        blank=True,
        help_text="Message for drop-off-only scenarios."
    )

    phone_number = models.CharField(max_length=50, blank=True)
    info_url = models.URLField(max_length=500, blank=True)
    booking_url = models.URLField(max_length=500, blank=True)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "booking_rules"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "booking_rule_id"],
                name="unique_booking_rule_per_scenario",
            )
        ]

    def __str__(self):
        return self.booking_rule_id
