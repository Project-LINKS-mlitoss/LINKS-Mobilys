# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class StopNameKeywords(models.Model):
    stop_group_id = models.AutoField(primary_key=True)
    stop_name_keyword = models.CharField(max_length=200, error_messages={'unique':"このキーワードは既に存在します。他のキーワードを選択してください。"})
    stop_group_id_label = models.CharField(max_length=200, default="SG000000")
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    stop_names_long = models.FloatField(default=0.0, help_text="Longitude for the stop names")
    stop_names_lat = models.FloatField(default=0.0, help_text="Latitude for the stop names")

    class Meta:
        db_table = 'stop_name_keywords'
        unique_together = (('stop_name_keyword', 'scenario'),)

    def __str__(self):
        return self.stop_name_keyword

class StopNameKeywordMap(models.Model):
    stop_id = models.CharField(max_length=200)
    stop_name_group_id = models.CharField(max_length=200)
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    can_automatically_update = models.BooleanField(default = True)

    class Meta:
        db_table = 'stop_name_keyword_map'
        unique_together = (('stop_id', 'stop_name_group_id', 'scenario'),)

    def __str__(self):
        return f"{self.stop_id} - {self.stop_name_group_id}"

class StopIdKeyword(models.Model):
    stop_group_id = models.AutoField(primary_key=True)
    stop_id_keyword = models.CharField(max_length=200, error_messages={'unique':"このキーワードは既に存在します。他のキーワードを選択してください。"})
    stop_group_name_label = models.CharField(max_length=200, default="label")
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    stop_id_long = models.FloatField(default=0.0, help_text="Longitude for the stop ID")
    stop_id_lat = models.FloatField(default=0.0, help_text="Latitude for the stop ID")

    class Meta:
        db_table = 'stop_id_keyword'
        unique_together = (('stop_id_keyword', 'scenario'),)

    def __str__(self):
        return self.stop_id_keyword

class StopIdKeywordMap(models.Model):
    stop_id = models.CharField(max_length=200)
    stop_id_group_id = models.IntegerField()
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)
    can_automatically_update = models.BooleanField(default = True)

    class Meta:
        db_table = 'stop_id_keyword_map'
        unique_together = (('stop_id_group_id', 'stop_id', 'scenario'),)

    def __str__(self):
        return f"{self.stop_id_group_id} - {self.stop_id}"

class RouteKeywords(models.Model):
	id = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
	keyword = models.CharField(max_length = 200)
	scenario = models.ForeignKey(Scenario, on_delete = models.CASCADE)
	created_datetime = models.DateTimeField(auto_now_add = True)
	updated_datetime = models.DateTimeField(auto_now = True)
	keyword_color = models.CharField(max_length = 6, default = '000000', help_text = "Hex color code for the keyword, default is black (000000)")

	class Meta:
		db_table = 'route_keywords'
		models.UniqueConstraint(
			fields = ['keyword', 'scenario'],
			name = 'unique_keyword_scenario'
		)
	
	def __str__(self):
		return self.keyword

class RouteKeywordMap(models.Model):
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    route_id = models.CharField(max_length=200)
    keyword = models.ForeignKey(RouteKeywords, on_delete=models.CASCADE)
    can_automatically_update = models.BooleanField(default=True)

    class Meta:
        db_table = 'route_keyword_map'
        models.UniqueConstraint(
            fields=['scenario', 'route_id', 'keyword'],
            name='unique_route_keyword_map'
        )

    def __str__(self):
        return f"{self.route_id} -> {self.keyword.keyword} (Is Manual?: {self.is_manually_update})"
