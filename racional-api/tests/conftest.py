"""Shared pytest fixtures.

The price provider is monkeypatched globally so tests never hit yfinance.
A small in-memory mapping returns deterministic prices, and individual
tests can override it via ``fake_price_provider.prices[...]``.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Iterator

import pytest

from apps.stocks import services as stock_services
from apps.stocks.models import Stock
from apps.users.models import User

DEFAULT_PRICES: dict[str, Decimal] = {
    "AAPL": Decimal("100.0000"),
    "MSFT": Decimal("200.0000"),
    "GOOGL": Decimal("50.0000"),
}


class _FakeProvider:
    def __init__(self, prices: dict[str, Decimal]) -> None:
        self.prices = prices

    def __call__(self, symbol: str) -> Decimal | None:
        return self.prices.get(symbol)


@pytest.fixture(autouse=True)
def fake_price_provider(monkeypatch: pytest.MonkeyPatch) -> Iterator[_FakeProvider]:
    provider = _FakeProvider(dict(DEFAULT_PRICES))
    monkeypatch.setattr(stock_services, "price_provider", provider)
    yield provider


@pytest.fixture
def seeded_stocks(db) -> list[Stock]:
    return [
        Stock.objects.create(symbol="AAPL", name="Apple Inc.", currency="USD"),
        Stock.objects.create(symbol="MSFT", name="Microsoft Corp.", currency="USD"),
        Stock.objects.create(symbol="GOOGL", name="Alphabet Inc.", currency="USD"),
    ]


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="alice@example.com",
        password="StrongPass!1234",
        first_name="Alice",
    )
