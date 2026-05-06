"""Stock catalog with a price cache.

Each row keeps the last fetched price plus a timestamp so
``stocks.services.get_price`` can decide whether to hit yfinance again.
We do not store a full price history on purpose: the API contract only
needs "current price". Adding a ``StockPriceHistory`` table later is a
trivial extension.
"""
from __future__ import annotations

from django.db import models


class Stock(models.Model):
    symbol = models.CharField(
        max_length=20,
        primary_key=True,
        help_text="Ticker symbol, e.g. AAPL. Used as natural PK.",
    )
    name = models.CharField(max_length=200)
    currency = models.CharField(max_length=8, default="USD")

    last_price = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
    )
    last_price_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["symbol"]

    def __str__(self) -> str:
        return self.symbol
