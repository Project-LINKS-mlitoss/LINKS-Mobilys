# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from gtfs.constants import (
    SourceType,
    StopsGroupingMethod,
    GraphStatus,
    ScenarioDeletionState,
    ScenarioEditState,
)


class Scenario(models.Model):
    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    scenario_name = models.CharField(max_length=200, error_messages={'unique':"このシナリオ名は既に存在します。他の名前を選択してください。"})
    gtfs_filename = models.CharField(max_length=200, null=True)
    source_type = models.IntegerField(choices=SourceType.choices())
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    stops_grouping_method = models.CharField(
        max_length=200,
        choices=StopsGroupingMethod.choices(),
        default=StopsGroupingMethod.STOP_NAME.value,
        blank=True,
        help_text="Method to group stops. Default is 'stop_name'."
    )
    start_date = models.DateField(null=True, help_text="The start date for the scenario.")
    end_date = models.DateField(null=True, help_text="The end date for the scenario.")
    source_scenario = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='cloned_scenarios')
    osm_graph_status = models.CharField(
        max_length=20,
        choices=GraphStatus.choices(),
        default=GraphStatus.PENDING.value
    )
    drm_graph_status = models.CharField(
        max_length=20,
        choices=GraphStatus.choices(),
        default=GraphStatus.PENDING.value
    )
    osm_graph_build_fail_log = models.TextField(
        null=True,
        blank=True
    )
    drm_graph_build_fail_log = models.TextField(
        null=True,
        blank=True
    )

    deletion_state = models.CharField(
        max_length=100,
        choices=ScenarioDeletionState.choices(),
        default=ScenarioDeletionState.ACTIVE.value
    )
    edit_state = models.CharField(
        max_length=100,
        choices=ScenarioEditState.choices(),
        default=ScenarioEditState.ORIGINAL.value
    )
    # stops_data, routes_data, etc.
    edited_data = ArrayField(
        base_field=models.CharField(max_length=200),
        null=False,
        default=list,
        help_text="Path to the edited GTFS data file."
    )

    prefecture_info = ArrayField(
        base_field=models.CharField(max_length=200),
        null=False,
        default=list,
        help_text="Path to the prefecture GTFS data file."
    )

    region_info = ArrayField(
        base_field=models.CharField(max_length=200),
        null=False,
        default=list,
        help_text="Path to the region GTFS data file."
    )

    class Meta:
        ordering = ['-created_datetime']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'scenario_name'],
                name='unique_scenario_name_per_user',
            ),
        ]

    def __str__(self):
        return self.scenario_name
