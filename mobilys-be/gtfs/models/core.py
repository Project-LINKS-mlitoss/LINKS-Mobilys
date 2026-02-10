import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from gtfs.constants import (
    RouteType,
    LocationType,
    WheelchairAccessible,
    BikesAllowed,
    CarsAllowed,
    PickupDropOffType,
    DirectionType,
    TimepointType,
)
from .scenario import Scenario

class Agency(models.Model):
    agency_id = models.CharField(max_length=200)
    agency_name = models.CharField(max_length=200)
    agency_url = models.URLField(max_length=200, blank=True)
    agency_timezone = models.CharField(max_length=50, blank=True)
    agency_lang = models.CharField(max_length=10, blank=True)
    agency_phone = models.CharField(max_length=20, blank=True)
    agency_fare_url = models.URLField(max_length=200, blank=True)
    # GTFS global + JP extra fields
    agency_email = models.EmailField(max_length=200, blank=True)
    cemv_support = models.BooleanField(
        null=True,
        blank=True,
        help_text="Indicates contactless EMV support if provided by the feed."
    )
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agency'
        constraints = [
            models.UniqueConstraint(fields=['agency_id', 'scenario'], name='unique_field_agency_id_scenario'),
        ]

    def __str__(self):
        return self.agency_name

class Stops(models.Model):
    stop_id = models.CharField(max_length=200)
    stop_code = models.CharField(max_length=200, blank=True)
    stop_name = models.CharField(max_length=200)
    stop_desc = models.TextField(blank=True)
    stop_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    stop_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    zone_id = models.CharField(max_length=200, blank=True)
    stop_url = models.URLField(max_length=200, blank=True)
    location_type = models.IntegerField(
        choices=LocationType.choices(),
        null=True,
        default=LocationType.STOP.value
    )
    parent_station = models.CharField(max_length=200, blank=True)
    wheelchair_boarding = models.IntegerField(
        choices=WheelchairAccessible.choices(),
        null=True,
        blank=True
    )
    platform_code = models.CharField(max_length=200, blank=True, null=True)
    # GTFS extra fields
    tts_stop_name = models.CharField(max_length=200, blank=True)
    stop_timezone = models.CharField(max_length=50, blank=True)
    level_id = models.CharField(max_length=200, blank=True)
    stop_access = models.IntegerField(
        null=True,
        blank=True,
        help_text="GTFS stop_access field, if provided."
    )
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stops'
        models.UniqueConstraint(
            fields=['scenario', 'stop_id'],
            name='unique_scenario_stop_sequence'
        )

    def __str__(self):
        return self.stop_name

class Routes(models.Model):
    route_id = models.CharField(max_length=200)
    agency_id = models.CharField(max_length=200)
    route_short_name = models.CharField(max_length=200, blank=True)
    route_long_name = models.CharField(max_length=200, blank=True)
    route_desc = models.TextField(blank=True)
    route_type = models.IntegerField(
        choices=RouteType.choices(),
        default=RouteType.BUS.value
    )
    route_url = models.URLField(max_length=200, blank=True)
    route_color = models.CharField(max_length=6, blank=True)
    route_text_color = models.CharField(max_length=6, blank=True)
    # GTFS global + JP extra fields
    route_sort_order = models.IntegerField(null=True, blank=True)
    continuous_pickup = models.IntegerField(
        choices=PickupDropOffType.choices(),
        null=True,
        blank=True
    )
    continuous_drop_off = models.IntegerField(
        choices=PickupDropOffType.choices(),
        null=True,
        blank=True
    )
    network_id = models.CharField(max_length=200, blank=True)
    cemv_support = models.BooleanField(
        null=True,
        blank=True,
        help_text="Indicates contactless EMV support at route level."
    )
    jp_parent_route_id = models.CharField(max_length=200, blank=True)
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'routes'
        models.UniqueConstraint(
            fields=['scenario', 'route_id'],
            name='unique_scenario_route_id'
        )

    def __str__(self):
        return self.route_short_name

class Shape(models.Model):
    shape_id = models.CharField(max_length=200)
    shape_pt_lat = models.FloatField()
    shape_pt_lon = models.FloatField()
    shape_pt_sequence = models.IntegerField()
    shape_dist_traveled = models.FloatField(null=True, blank=True)
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shapes'
        models.UniqueConstraint(
            fields=['scenario', 'shape_id', 'shape_pt_sequence'],
            name='unique_scenario_shape_sequence'
        )

    def __str__(self):
        return f"Shape {self.shape_id} - Point {self.shape_pt_sequence}"

class Trips(models.Model):
    trip_id = models.CharField(max_length=200)
    route_id = models.CharField(max_length=200)
    service_id = models.CharField(max_length=200)
    trip_headsign = models.CharField(max_length=200, blank=True)
    trip_short_name = models.CharField(max_length=200, blank=True)
    direction_id = models.IntegerField(
        choices=DirectionType.choices(),
        null=True,
        blank=True
    )
    block_id = models.CharField(max_length=200, blank=True)
    shape_id = models.CharField(max_length=200, blank=True)
    # GTFS global + JP extra fields
    wheelchair_accessible = models.IntegerField(
        choices=WheelchairAccessible.choices(),
        null=True,
        blank=True
    )
    bikes_allowed = models.IntegerField(
        choices=BikesAllowed.choices(),
        null=True,
        blank=True
    )
    cars_allowed = models.IntegerField(
        choices=CarsAllowed.choices(),
        null=True,
        blank=True
    )
    jp_trip_desc = models.TextField(blank=True)
    jp_trip_desc_symbol = models.CharField(max_length=50, blank=True)
    jp_office_id = models.CharField(max_length=200, blank=True)
    jp_pattern_id = models.CharField(max_length=200, blank=True)
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    is_direction_id_generated = models.BooleanField(
        default=False, help_text="Indicates if the direction_id was generated automatically.")

    class Meta:
        db_table = 'trips'
        constraints = [
            models.UniqueConstraint(
                fields=['scenario', 'trip_id'],
                name='unique_scenario_trip_id'
            ),
        ]

    def __str__(self):
        return self.trip_id

class StopTimes(models.Model):
    trip_id = models.CharField(max_length=200)
    arrival_time = models.TimeField(null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    stop_id = models.CharField(max_length=200)
    stop_sequence = models.IntegerField()
    stop_headsign = models.CharField(max_length=200, blank=True)
    pickup_type = models.IntegerField(
        choices=PickupDropOffType.choices(),
        null=True,
        default=PickupDropOffType.REGULAR.value
    )
    drop_off_type = models.IntegerField(
        choices=PickupDropOffType.choices(),
        null=True,
        default=PickupDropOffType.REGULAR.value
    )
    shape_dist_traveled = models.FloatField(null=True, blank=True) 
    # GTFS global extra fields (flex / location groups)
    location_group_id = models.CharField(max_length=200, blank=True)
    location_id = models.CharField(max_length=200, blank=True)
    start_pickup_drop_off_window = models.TimeField(null=True, blank=True)
    end_pickup_drop_off_window = models.TimeField(null=True, blank=True)
    continuous_pickup = models.IntegerField(
        choices=PickupDropOffType.choices(),
        null=True,
        blank=True
    )
    continuous_drop_off = models.IntegerField(
        choices=PickupDropOffType.choices(),
        null=True,
        blank=True
    )
    pickup_booking_rule_id = models.CharField(max_length=200, blank=True)
    drop_off_booking_rule_id = models.CharField(max_length=200, blank=True)
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    timepoint = models.SmallIntegerField(
        choices=TimepointType.choices(),
        null=True,
        blank=True,
        help_text="GTFS timepoint: 1=exact, 0=approximate, null=unspecified",
    )
    is_arrival_time_next_day = models.BooleanField(
        default=False, help_text="Indicates if the arrival time is on the next day."
    )
    is_departure_time_next_day = models.BooleanField(
        default=False, help_text="Indicates if the departure time is on the next day."
    )

    class Meta:
        db_table = 'stop_times'
        models.UniqueConstraint(
            fields=['scenario', 'trip_id', 'stop_sequence'],
            name='unique_scenario_trip_stop_sequence'
        )
        indexes = [
            models.Index(fields=['trip_id', 'stop_sequence'])
        ]

    def __str__(self):
        return f"{self.trip_id} - {self.stop_id} at {self.arrival_time}"

class Frequencies(models.Model):
    """
    frequencies.txt
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    trip_id = models.CharField(max_length=200)
    start_time = models.TimeField()
    end_time = models.TimeField()
    headway_secs = models.IntegerField()
    exact_times = models.IntegerField(null=True, blank=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "frequencies"
        indexes = [
            models.Index(fields=['scenario', 'trip_id']),
        ]

    def __str__(self):
        return f"{self.trip_id} {self.start_time}-{self.end_time}"
