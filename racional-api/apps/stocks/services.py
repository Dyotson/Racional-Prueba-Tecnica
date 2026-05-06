"""Price retrieval with cache.

``get_price(symbol)`` is the single entry point used everywhere in the
codebase (orders, total computation, /stocks endpoint). It encapsulates
the cache-vs-fetch decision so the rest of the app does not have to
worry about TTLs or yfinance.

Design notes:
- The cache lives in the ``Stock`` row itself (``last_price`` +
  ``last_price_at``). One source of truth, no Redis dependency.
- TTL is configurable via ``STOCK_PRICE_TTL_SECONDS`` (default 300s).
- yfinance failures are swallowed: the function returns the cached value
  with ``is_stale=True``. This keeps the API responsive when the
  external dependency is flaky.
- Imports of yfinance are lazy so unit tests can monkeypatch
  ``_fetch_price_from_provider`` without paying its import cost.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Callable

from django.conf import settings

from apps.stocks.models import Stock


@dataclass(frozen=True)
class PriceQuote:
    symbol: str
    price: Decimal | None
    fetched_at: datetime | None
    is_stale: bool


def _fetch_price_from_provider(symbol: str) -> Decimal | None:
    """Real implementation: fetch from yfinance.

    Kept private and side-effect-free (no DB writes). Returns ``None`` on
    failure so callers can decide what to do.

    yfinance is famously flaky (Yahoo changes their backend often, see
    GH#2520). We try three increasingly tolerant approaches so a
    transient failure on one method does not poison the whole call:
    1) ``fast_info.last_price`` -- cheapest, single endpoint.
    2) ``info["regularMarketPrice"]`` -- heavier but different endpoint.
    3) ``history(period="1d")`` close -- last resort.
    Each attempt is wrapped in its own try block; any uncaught exception
    just returns ``None`` so the caller falls back to the cached value.
    """
    try:
        import yfinance as yf
    except Exception:
        return None

    try:
        ticker = yf.Ticker(symbol)
    except Exception:
        return None

    candidates: list[Callable[[], object]] = [
        lambda: getattr(ticker.fast_info, "last_price", None),
        lambda: ticker.info.get("regularMarketPrice"),
        lambda: _last_close_from_history(ticker),
    ]
    for fetch in candidates:
        try:
            value = fetch()
        except Exception:
            continue
        if value is None:
            continue
        try:
            price = Decimal(str(value))
        except Exception:
            continue
        if price <= 0:
            continue
        return price.quantize(Decimal("0.0001"))
    return None


def _last_close_from_history(ticker: object) -> object:
    """Pull the most recent close from a 1-day history frame, if available."""
    history = ticker.history(period="1d", auto_adjust=False)  # type: ignore[attr-defined]
    if history is None or len(history) == 0:
        return None
    return history["Close"].iloc[-1]


# Hook so tests can swap the provider without touching DB caching logic.
price_provider: Callable[[str], Decimal | None] = _fetch_price_from_provider


def _is_fresh(stock: Stock) -> bool:
    if stock.last_price is None or stock.last_price_at is None:
        return False
    ttl = timedelta(seconds=int(settings.STOCK_PRICE_TTL_SECONDS))
    return (datetime.now(timezone.utc) - stock.last_price_at) < ttl


def get_price(symbol: str) -> PriceQuote:
    """Return the freshest known price for ``symbol``.

    Behaviour:
    - If the stock is unknown (not in the catalog), return all-None.
    - If the cached price is within TTL, return it.
    - Else try the provider. On success, persist and return fresh.
    - Else fall back to the cached value with ``is_stale=True``.
    """
    try:
        stock = Stock.objects.get(symbol=symbol.upper())
    except Stock.DoesNotExist:
        return PriceQuote(symbol=symbol.upper(), price=None, fetched_at=None, is_stale=True)

    if _is_fresh(stock):
        return PriceQuote(
            symbol=stock.symbol,
            price=stock.last_price,
            fetched_at=stock.last_price_at,
            is_stale=False,
        )

    fresh_price = price_provider(stock.symbol)
    if fresh_price is not None:
        stock.last_price = fresh_price
        stock.last_price_at = datetime.now(timezone.utc)
        stock.save(update_fields=["last_price", "last_price_at", "updated_at"])
        return PriceQuote(
            symbol=stock.symbol,
            price=fresh_price,
            fetched_at=stock.last_price_at,
            is_stale=False,
        )

    return PriceQuote(
        symbol=stock.symbol,
        price=stock.last_price,
        fetched_at=stock.last_price_at,
        is_stale=True,
    )
