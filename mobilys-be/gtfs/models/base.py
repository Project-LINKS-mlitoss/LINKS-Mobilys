"""Shared model mixins / abstract bases.

Currently empty; kept for future refactors.
"""

from django.db import models


class BaseModel(models.Model):
    class Meta:
        abstract = True
