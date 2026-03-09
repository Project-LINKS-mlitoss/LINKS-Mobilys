# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from .scenario import Scenario

class AgencyJP(models.Model):
    """
    agency_jp.txt
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    agency_id = models.CharField(max_length=200)
    agency_official_name = models.CharField(max_length=200, blank=True)
    agency_zip_number = models.CharField(max_length=20, blank=True)
    agency_address = models.CharField(max_length=255, blank=True)
    agency_president_pos = models.CharField(max_length=200, blank=True)
    agency_president_name = models.CharField(max_length=200, blank=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agency_jp"
        unique_together = (('scenario', 'agency_id'),)

    def __str__(self):
        return self.agency_official_name or self.agency_id

class OfficeJP(models.Model):
    """
    office_jp.txt
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    office_id = models.CharField(max_length=200)
    office_name = models.CharField(max_length=200)
    office_url = models.URLField(max_length=500, blank=True)
    office_phone = models.CharField(max_length=50, blank=True)
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "office_jp"
        unique_together = (('scenario', 'office_id'),)

    def __str__(self):
        return self.office_name or self.office_id

class PatternJP(models.Model):
    """
    pattern_jp.txt (社内拡張)
    """
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)

    jp_pattern_id = models.CharField(max_length=200)  # 必須
    route_update_date = models.DateField(null=True, blank=True)  # 任意
    origin_stop = models.CharField(max_length=200, blank=True)   # 任意
    via_stop = models.CharField(max_length=200, blank=True)      # 任意
    destination_stop = models.CharField(max_length=200, blank=True)  # 任意

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pattern_jp"
        unique_together = (('scenario', 'jp_pattern_id'),)

    def __str__(self):
        return self.jp_pattern_id
