import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class FeedInfo(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    feed_publisher_name = models.CharField(max_length=256)
    feed_publisher_url = models.URLField(max_length=500)
    feed_lang = models.CharField(max_length=10)

    default_lang = models.CharField(max_length=10, blank=True)

    feed_start_date = models.DateField()
    feed_end_date = models.DateField()

    feed_version = models.CharField(max_length=100)

    feed_contact_email = models.EmailField(max_length=254, blank=True)
    feed_contact_url = models.URLField(max_length=500, blank=True)

    class Meta:
        db_table = "feed_info"

    def __str__(self):
        return f"{self.feed_publisher_name} ({self.feed_version})"
    

#Translations

class Translation(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    table_name = models.CharField(max_length = 200 )
    field_name = models.CharField(max_length = 200)
    field_value = models.TextField(blank = True, default = "")
    language = models.CharField(max_length = 100)
    translation = models.TextField()
    # GTFS translation keys
    record_id = models.CharField(max_length=200, blank=True)
    record_sub_id = models.CharField(max_length=200, blank=True)

    route_id = models.CharField(max_length=200, blank=True)
    trip_id = models.CharField(max_length = 200, blank = True)
    service_id = models.CharField(max_length = 200, blank = True)
    stop_id = models.CharField(max_length = 200, blank = True)
    shape_id = models.CharField(max_length = 200, blank = True)
    feed_info_id = models.CharField(max_length = 200, blank = True)

    class Meta:
        db_table = 'translations'
        indexes = [
            models.Index(fields = ['scenario', 'table_name', 'field_name', 'language']), 
        ]
        # constraints = [
        #     models.UniqueConstraint(
        #         fields = [
        #             'scenario',
        #             'table_name',
        #             'field_name',
        #             'language',
        #             'route_id',
        #             'trip_id',
        #             'service_id',
        #             'stop_id',
        #             'shape_id',
        #             'feed_info_id',
        #         ],
        #         name = 'uniq_translation_per_entity_and_lang',
        #     ),
        # ]

    def __str__(self):
        return f"{self.table_name}.{self.field_name}[{self.language}] -> {self.translation[:30]}..."

class Attribution(models.Model):

    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    attribution_id = models.CharField(max_length=200)

    agency_id = models.CharField(max_length=200, blank=True)
    route_id = models.CharField(max_length=200, blank=True)
    trip_id = models.CharField(max_length=200, blank=True)

    organization_name = models.CharField(max_length=255)

    is_producer = models.IntegerField(
        null=True, blank=True,
        help_text="1 if organization is a producer, else 0/empty"
    )
    is_operator = models.IntegerField(
        null=True, blank=True,
        help_text="1 if organization is an operator, else 0/empty"
    )
    is_authority = models.IntegerField(
        null=True, blank=True,
        help_text="1 if organization is an authority, else 0/empty"
    )

    attribution_url = models.URLField(max_length=500, blank=True)
    attribution_email = models.EmailField(max_length=254, blank=True)
    attribution_phone = models.CharField(max_length=50, blank=True)

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attributions"
        constraints = [
            models.UniqueConstraint(
                fields=["scenario", "attribution_id"],
                name="unique_attribution_per_scenario",
            )
        ]

    def __str__(self):
        return self.organization_name
