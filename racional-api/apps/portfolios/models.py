"""Portfolio model.

The portfolio is the aggregate that owns money (``cash_balance``) and
collects transactions/orders. It is 1:1 with User per the product
requirements.

Money is stored as ``Decimal(18, 4)``: 4 decimals is enough for cents at
any sensible currency, and 18 total digits gives us trillions of headroom.
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel

ZERO = Decimal("0")


class Portfolio(UUIDModel, TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="portfolio",
    )
    name = models.CharField(max_length=120, default="My portfolio")
    description = models.TextField(blank=True, default="")
    cash_balance = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=ZERO,
        help_text="Available cash. Updated atomically on deposits/withdrawals/orders.",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user_id}'s portfolio"
