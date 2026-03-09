# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from django.apps import AppConfig


class ImportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'gtfs'

    def ready(self):
        import gtfs.signals
