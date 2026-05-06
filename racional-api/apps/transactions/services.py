"""Domain services for cash movements and orders.

All write paths go through these functions. Each one:
1. Locks the portfolio row (``select_for_update``) to serialize concurrent
   writes against the same balance.
2. Validates the business rule (sufficient cash, sufficient holding,
   stock available).
3. Writes the ledger row and updates the denormalized ``cash_balance``.
4. Returns the new row + the refreshed portfolio.

Anything that raises a ``BusinessRuleError`` short-circuits the
transaction so the DB stays consistent.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import transaction
from django.db.models import DecimalField, Q, Sum
from django.db.models.functions import Coalesce

from apps.core.exceptions import (
    InsufficientFunds,
    InsufficientHoldings,
    StockNotAvailable,
)
from apps.portfolios.models import Portfolio
from apps.stocks.models import Stock
from apps.stocks.services import get_price
from apps.transactions.models import (
    CashKind,
    CashTransaction,
    Order,
    OrderSide,
)

if TYPE_CHECKING:
    from apps.users.models import User

ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Cash transactions
# ---------------------------------------------------------------------------


@transaction.atomic
def deposit(user: "User", *, amount: Decimal, transaction_date: date) -> CashTransaction:
    portfolio = _lock_portfolio(user)
    tx = CashTransaction.objects.create(
        portfolio=portfolio,
        kind=CashKind.DEPOSIT,
        amount=amount,
        transaction_date=transaction_date,
    )
    portfolio.cash_balance = (portfolio.cash_balance + amount).quantize(Decimal("0.0001"))
    portfolio.save(update_fields=["cash_balance", "updated_at"])
    return tx


@transaction.atomic
def withdraw(user: "User", *, amount: Decimal, transaction_date: date) -> CashTransaction:
    portfolio = _lock_portfolio(user)
    if portfolio.cash_balance < amount:
        raise InsufficientFunds(
            f"Cash balance {portfolio.cash_balance} is below requested amount {amount}."
        )
    tx = CashTransaction.objects.create(
        portfolio=portfolio,
        kind=CashKind.WITHDRAWAL,
        amount=amount,
        transaction_date=transaction_date,
    )
    portfolio.cash_balance = (portfolio.cash_balance - amount).quantize(Decimal("0.0001"))
    portfolio.save(update_fields=["cash_balance", "updated_at"])
    return tx


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


@transaction.atomic
def place_buy(user: "User", *, symbol: str, quantity: Decimal) -> Order:
    portfolio = _lock_portfolio(user)
    stock = _get_stock_or_raise(symbol)
    price = _resolve_execution_price(stock)
    cost = (quantity * price).quantize(Decimal("0.0001"))
    if portfolio.cash_balance < cost:
        raise InsufficientFunds(
            f"Cash balance {portfolio.cash_balance} is below order cost {cost}."
        )

    now = datetime.now(timezone.utc)
    order = Order.objects.create(
        portfolio=portfolio,
        symbol=stock.symbol,
        side=OrderSide.BUY,
        quantity=quantity,
        price=price,
        executed_at=now,
    )
    portfolio.cash_balance = (portfolio.cash_balance - cost).quantize(Decimal("0.0001"))
    portfolio.save(update_fields=["cash_balance", "updated_at"])
    return order


@transaction.atomic
def place_sell(user: "User", *, symbol: str, quantity: Decimal) -> Order:
    portfolio = _lock_portfolio(user)
    stock = _get_stock_or_raise(symbol)
    held = _current_holding_qty(portfolio, stock.symbol)
    if held < quantity:
        raise InsufficientHoldings(
            f"Holding for {stock.symbol} is {held}, cannot sell {quantity}."
        )

    price = _resolve_execution_price(stock)
    proceeds = (quantity * price).quantize(Decimal("0.0001"))
    now = datetime.now(timezone.utc)
    order = Order.objects.create(
        portfolio=portfolio,
        symbol=stock.symbol,
        side=OrderSide.SELL,
        quantity=quantity,
        price=price,
        executed_at=now,
    )
    portfolio.cash_balance = (portfolio.cash_balance + proceeds).quantize(Decimal("0.0001"))
    portfolio.save(update_fields=["cash_balance", "updated_at"])
    return order


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _lock_portfolio(user: "User") -> Portfolio:
    """Acquire a row-level lock on the user's portfolio for the txn duration."""
    return Portfolio.objects.select_for_update().get(user=user)


def _get_stock_or_raise(symbol: str) -> Stock:
    try:
        return Stock.objects.get(symbol=symbol.upper())
    except Stock.DoesNotExist as exc:
        raise StockNotAvailable(f"Unknown symbol '{symbol.upper()}'.") from exc


def _resolve_execution_price(stock: Stock) -> Decimal:
    """Use the live (or cached) price as the execution price.

    We refuse to execute an order if no price is available at all, since
    that would force us to invent a number. Stale cache is acceptable
    (markets close, etc.) - the downstream PnL calculation will reflect
    reality once the price refreshes.
    """
    quote = get_price(stock.symbol)
    if quote.price is None:
        raise StockNotAvailable(
            f"No price available for {stock.symbol}. Try again later."
        )
    return quote.price


def _current_holding_qty(portfolio: Portfolio, symbol: str) -> Decimal:
    """Sum of buys minus sells for ``symbol`` within ``portfolio``."""
    qty_field = DecimalField(max_digits=20, decimal_places=8)
    agg = Order.objects.filter(portfolio=portfolio, symbol=symbol).aggregate(
        buy=Coalesce(
            Sum("quantity", filter=Q(side=OrderSide.BUY), output_field=qty_field),
            ZERO,
            output_field=qty_field,
        ),
        sell=Coalesce(
            Sum("quantity", filter=Q(side=OrderSide.SELL), output_field=qty_field),
            ZERO,
            output_field=qty_field,
        ),
    )
    return (agg["buy"] or ZERO) - (agg["sell"] or ZERO)


# ---------------------------------------------------------------------------
# Read services
# ---------------------------------------------------------------------------


def list_movements(
    user: "User", *, limit: int = 20, offset: int = 0
) -> tuple[list[dict], int]:
    """Return a unified, paginated movement feed.

    Implementation note: we fetch the (offset+limit) most recent rows
    from each table, merge them in Python, and slice. This keeps the
    code straightforward for the take-home and is fine for the
    cardinalities we expect. For very large portfolios a UNION ALL view
    or a materialized "movements" table would scale better.
    """
    portfolio = Portfolio.objects.get(user=user)
    window = limit + offset

    cash_qs = list(
        CashTransaction.objects.filter(portfolio=portfolio).order_by("-transaction_date", "-created_at")[:window]
    )
    order_qs = list(
        Order.objects.filter(portfolio=portfolio).order_by("-executed_at", "-created_at")[:window]
    )

    items: list[dict] = []
    for c in cash_qs:
        items.append(
            {
                "id": c.id,
                "kind": c.kind,
                "amount": c.amount,
                "occurred_at": datetime.combine(
                    c.transaction_date, datetime.min.time(), tzinfo=timezone.utc
                ),
                "symbol": None,
                "quantity": None,
                "price": None,
            }
        )
    for o in order_qs:
        items.append(
            {
                "id": o.id,
                "kind": o.side,
                "amount": (o.quantity * o.price).quantize(Decimal("0.0001")),
                "occurred_at": o.executed_at,
                "symbol": o.symbol,
                "quantity": o.quantity,
                "price": o.price,
            }
        )

    items.sort(key=lambda r: r["occurred_at"], reverse=True)
    paginated = items[offset : offset + limit]

    total = (
        CashTransaction.objects.filter(portfolio=portfolio).count()
        + Order.objects.filter(portfolio=portfolio).count()
    )
    return paginated, total
