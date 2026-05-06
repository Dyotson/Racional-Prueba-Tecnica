"""Stocks routes."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from django.conf import settings
from ninja import Router

from apps.core.exceptions import StockNotAvailable
from apps.stocks.models import Stock
from apps.stocks.schemas import StockOut
from apps.stocks.services import get_price

router = Router()


@router.get("/available", response=list[StockOut])
def get_available_stocks(request) -> list[StockOut]:
    """Return the catalog with the most recent *cached* price for each stock."""
    # Decided to use *cached* price because of yfinance being flaky, and the API is meant to be a demo.
    ttl = timedelta(seconds=int(settings.STOCK_PRICE_TTL_SECONDS))
    now = datetime.now(timezone.utc)
    stocks = Stock.objects.all()
    return [
        StockOut(
            symbol=s.symbol,
            name=s.name,
            currency=s.currency,
            price=s.last_price,
            price_at=s.last_price_at,
            is_stale=(
                s.last_price is None
                or s.last_price_at is None
                or (now - s.last_price_at) >= ttl
            ),
        )
        for s in stocks
    ]


@router.get("/{symbol}", response=StockOut)
def get_stock(request, symbol: str) -> StockOut:
    """Return the stock with the most recent *cached* price."""
    symbol_upper = symbol.upper()
    try:
        stock = Stock.objects.get(symbol=symbol_upper)
    except Stock.DoesNotExist as exc:
        raise StockNotAvailable(f"Unknown symbol '{symbol_upper}'.") from exc

    quote = get_price(symbol_upper)
    return StockOut(
        symbol=stock.symbol,
        name=stock.name,
        currency=stock.currency,
        price=quote.price,
        price_at=quote.fetched_at,
        is_stale=quote.is_stale,
    )
