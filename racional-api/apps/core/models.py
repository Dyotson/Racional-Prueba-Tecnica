"""Abstract base models shared across apps."""
from __future__ import annotations

import uuid

from django.db import models


class UUIDModel(models.Model):
    """Use a UUID v4 PK so identifiers are non-guessable and globally unique."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Adds ``created_at``/``updated_at`` fields to a model."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
