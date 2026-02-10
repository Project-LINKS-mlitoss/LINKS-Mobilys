import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class Calendar(models.Model):
    service_id = models.CharField(max_length=200)
    monday = models.IntegerField()
    tuesday = models.IntegerField()
    wednesday = models.IntegerField()
    thursday = models.IntegerField()
    friday = models.IntegerField()
    saturday = models.IntegerField()
    sunday = models.IntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'calendar'
        models.UniqueConstraint(
            fields=['scenario', 'service_id'],
            name='unique_scenario_service_id'
        )

    def __str__(self):
        return f"Service {self.service_id} ({self.start_date} to {self.end_date})"

class CalendarDates(models.Model):
    service_id = models.CharField(max_length=200)
    date = models.DateField()
    exception_type = models.IntegerField()  # 1 for added, 2 for removed
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'calendar_dates'
        models.UniqueConstraint(
            fields=['scenario', 'service_id', 'date'],
            name='unique_scenario_service_date'
        )

    def __str__(self):
        return f"{self.service_id} - {self.date} "
