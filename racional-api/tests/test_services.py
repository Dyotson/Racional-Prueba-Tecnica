"""Service-layer tests.

We exercise the business rules directly (instead of via HTTP) because
they're the only thing the routers should validate. Going through the
service layer keeps the tests fast and independent of the HTTP plumbing.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from apps.core.exceptions import (
    InsufficientFunds,
    InsufficientHoldings,
    StockNotAvailable,
)
from apps.portfolios.services import compute_total, get_portfolio
from apps.transactions.services import (
    deposit,
    place_buy,
    place_sell,
    withdraw,
)


pytestmark = pytest.mark.django_db


def test_deposit_increases_cash_balance(user) -> None:
    deposit(user, amount=Decimal("1000"), transaction_date=date.today())
    portfolio = get_portfolio(user)
    assert portfolio.cash_balance == Decimal("1000.0000")


def test_withdraw_above_balance_raises(user) -> None:
    deposit(user, amount=Decimal("100"), transaction_date=date.today())
    with pytest.raises(InsufficientFunds):
        withdraw(user, amount=Decimal("200"), transaction_date=date.today())


def test_buy_requires_funds(user, seeded_stocks) -> None:
    with pytest.raises(InsufficientFunds):
        place_buy(user, symbol="AAPL", quantity=Decimal("1"))


def test_buy_succeeds_and_debits_cash(user, seeded_stocks) -> None:
    deposit(user, amount=Decimal("1000"), transaction_date=date.today())
    order = place_buy(user, symbol="AAPL", quantity=Decimal("3"))
    assert order.symbol == "AAPL"
    assert order.price == Decimal("100.0000")
    assert order.quantity == Decimal("3")
    portfolio = get_portfolio(user)
    assert portfolio.cash_balance == Decimal("700.0000")


def test_sell_without_holding_raises(user, seeded_stocks) -> None:
    deposit(user, amount=Decimal("1000"), transaction_date=date.today())
    with pytest.raises(InsufficientHoldings):
        place_sell(user, symbol="AAPL", quantity=Decimal("1"))


def test_sell_credits_proceeds(user, seeded_stocks, fake_price_provider) -> None:
    deposit(user, amount=Decimal("1000"), transaction_date=date.today())
    place_buy(user, symbol="AAPL", quantity=Decimal("3"))
    fake_price_provider.prices["AAPL"] = Decimal("110")
    # Force a refresh: the cache TTL is 5 min, so set last_price_at to None.
    from apps.stocks.models import Stock

    Stock.objects.filter(symbol="AAPL").update(last_price_at=None)
    place_sell(user, symbol="AAPL", quantity=Decimal("2"))
    portfolio = get_portfolio(user)
    # 1000 - 300 (buy at 100) + 220 (sell at 110) = 920
    assert portfolio.cash_balance == Decimal("920.0000")


def test_buy_unknown_symbol(user) -> None:
    with pytest.raises(StockNotAvailable):
        place_buy(user, symbol="ZZZZ", quantity=Decimal("1"))


def test_compute_total_aggregates_cash_and_holdings(user, seeded_stocks) -> None:
    deposit(user, amount=Decimal("10000"), transaction_date=date.today())
    place_buy(user, symbol="AAPL", quantity=Decimal("10"))  # 1000 @ 100
    place_buy(user, symbol="MSFT", quantity=Decimal("5"))   # 1000 @ 200

    snapshot = compute_total(get_portfolio(user))
    # cash: 10000 - 1000 - 1000 = 8000
    assert snapshot.cash_balance == Decimal("8000.0000")
    # holdings value: 10*100 + 5*200 = 2000
    assert snapshot.holdings_value == Decimal("2000.0000")
    assert snapshot.total_value == Decimal("10000.0000")
    assert not snapshot.prices_stale
    assert {h.symbol for h in snapshot.holdings} == {"AAPL", "MSFT"}


def test_compute_total_handles_partial_sell(user, seeded_stocks) -> None:
    deposit(user, amount=Decimal("10000"), transaction_date=date.today())
    place_buy(user, symbol="AAPL", quantity=Decimal("10"))
    place_sell(user, symbol="AAPL", quantity=Decimal("4"))
    snapshot = compute_total(get_portfolio(user))
    aapl = next(h for h in snapshot.holdings if h.symbol == "AAPL")
    assert aapl.quantity == Decimal("6")
    assert aapl.average_cost == Decimal("100.0000")
