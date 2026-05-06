"""Seed the Stock catalog with a small list of well-known tickers.

The API can only operate on stocks present in the catalog (see
``orders`` validation), so a fresh deployment must have at least a few
symbols available. This command is idempotent.

We also seed each stock with a *fallback* ``last_price`` so the demo is
usable even if yfinance is down (Yahoo's backend is famously flaky).
The fallback timestamp is left unset, so the price service treats it as
expired and will replace it with a fresh value the first time the
external API succeeds. Until then, callers see the seeded price flagged
``is_stale=True``.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand

from apps.stocks.models import Stock

DEFAULT_CATALOG: list[tuple[str, str, str, Decimal]] = [
    ("AAPL", "Apple Inc.", "USD", Decimal("190.0000")),
    ("MSFT", "Microsoft Corporation", "USD", Decimal("420.0000")),
    ("GOOGL", "Alphabet Inc.", "USD", Decimal("180.0000")),
    ("AMZN", "Amazon.com, Inc.", "USD", Decimal("195.0000")),
    ("META", "Meta Platforms, Inc.", "USD", Decimal("520.0000")),
    ("TSLA", "Tesla, Inc.", "USD", Decimal("250.0000")),
    ("NVDA", "NVIDIA Corporation", "USD", Decimal("130.0000")),
    ("NFLX", "Netflix, Inc.", "USD", Decimal("700.0000")),
    ("KO", "The Coca-Cola Company", "USD", Decimal("65.0000")),
    ("JPM", "JPMorgan Chase & Co.", "USD", Decimal("220.0000")),
]


class Command(BaseCommand):
    help = "Populate the Stock catalog with a default list of tickers."

    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for symbol, name, currency, fallback_price in DEFAULT_CATALOG:
            _, was_created = Stock.objects.get_or_create(
                symbol=symbol,
                defaults={
                    "name": name,
                    "currency": currency,
                    # Seed a fallback price; leave ``last_price_at=None``
                    # so the cache is considered expired and the first
                    # successful yfinance call refreshes it.
                    "last_price": fallback_price,
                },
            )
            if was_created:
                created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created} new stocks ({len(DEFAULT_CATALOG)} total in catalog)."
            )
        )
