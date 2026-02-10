import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class Map(models.Model):
    name = models.CharField(max_length=100)
    url = models.URLField(max_length=500)

    class Meta:
        db_table = 'map'

    def __str__(self):
        return self.name

class Profile(models.Model):
    user = models.OneToOneField(get_user_model(), on_delete=models.CASCADE)
    map = models.ForeignKey(Map, on_delete=models.SET_NULL, null=True, blank=True)

class Notification(models.Model):
    id = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    message = models.TextField()
    notification_path = models.CharField(max_length=255, help_text="Path to the notification resource")
    scenario_id = models.UUIDField(null=True, blank=True, help_text="Scenario ID related to the notification")
    screen_menu = models.CharField(max_length=100, help_text="Screen menu where the notification will be displayed")
    is_read = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True, help_text="Optional description for the notification")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    error_response = models.JSONField(blank=True, null=True, help_text="Optional error response details")

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username} at {self.created_at}"
