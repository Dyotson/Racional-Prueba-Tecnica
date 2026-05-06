"""Portfolio-level read/write services.

The "total value" computation lives here because it touches multiple apps
(orders to derive holdings, stocks to fetch prices). Routers should not
orchestrate cross-app logic directly.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce

from apps.portfolios.models import Portfolio
from apps.stocks.services import PriceQuote, get_price

if TYPE_CHECKING:
    from apps.users.models import User

ZERO = Decimal("0")


@dataclass(frozen=True)
class HoldingSnapshot:
    """Holding derived on-the-fly from the order history."""

    symbol: str
    name: str
    quantity: Decimal
    average_cost: Decimal
    current_price: Decimal | None
    market_value: Decimal | None
    unrealized_pnl: Decimal | None


@dataclass(frozen=True)
class PortfolioTotal:
    cash_balance: Decimal
    holdings_value: Decimal
    total_value: Decimal
    holdings: list[HoldingSnapshot]
    prices_stale: bool


def get_portfolio(user: "User") -> Portfolio:
    """Return the user's portfolio (always exists thanks to the post_save signal)."""
    return Portfolio.objects.select_related("user").get(user=user)


def update_portfolio(portfolio: Portfolio, **fields: str | None) -> Portfolio:
    changed = False
    for field, value in fields.items():
        if value is None:
            continue
        setattr(portfolio, field, value)
        changed = True
    if changed:
        portfolio.save()
    return portfolio


def compute_holdings(portfolio: Portfolio) -> list[HoldingSnapshot]:
    """Derive current holdings (qty + average cost) from order history.

    Done in SQL with a CASE expression so we don't materialize one row per
    order in Python. Returns only symbols with non-zero quantity.

    Average cost is computed using the classic accumulator formula:
        avg_cost = sum(buy_qty * buy_price) / sum(buy_qty)
    Sells reduce quantity but not the running average cost, which is the
    standard accounting treatment (FIFO/cost-basis simplification).
    """
    from apps.stocks.models import Stock
    from apps.transactions.models import Order, OrderSide

    qty_field = DecimalField(max_digits=20, decimal_places=8)
    cost_field = DecimalField(max_digits=24, decimal_places=8)

    aggregated = list(
        Order.objects.filter(portfolio=portfolio)
        .values("symbol")
        .annotate(
            buy_qty=Coalesce(
                Sum("quantity", filter=Q(side=OrderSide.BUY), output_field=qty_field),
                ZERO,
                output_field=qty_field,
            ),
            sell_qty=Coalesce(
                Sum("quantity", filter=Q(side=OrderSide.SELL), output_field=qty_field),
                ZERO,
                output_field=qty_field,
            ),
            buy_cost=Coalesce(
                Sum(
                    F("quantity") * F("price"),
                    filter=Q(side=OrderSide.BUY),
                    output_field=cost_field,
                ),
                ZERO,
                output_field=cost_field,
            ),
        )
    )

    for row in aggregated:
        row["quantity"] = (row["buy_qty"] or ZERO) - (row["sell_qty"] or ZERO)

    aggregated = [row for row in aggregated if row["quantity"] and row["quantity"] > 0]
    if not aggregated:
        return []

    symbols = [row["symbol"] for row in aggregated]
    stocks_by_symbol = {s.symbol: s for s in Stock.objects.filter(symbol__in=symbols)}

    snapshots: list[HoldingSnapshot] = []
    for row in aggregated:
        symbol: str = row["symbol"]
        qty: Decimal = row["quantity"]
        buy_qty: Decimal = row["buy_qty"] or ZERO
        buy_cost: Decimal = row["buy_cost"] or ZERO
        avg_cost = (buy_cost / buy_qty) if buy_qty else ZERO

        stock = stocks_by_symbol.get(symbol)
        quote: PriceQuote | None = None
        current_price: Decimal | None = None
        market_value: Decimal | None = None
        pnl: Decimal | None = None
        if stock is not None:
            quote = get_price(stock.symbol)
            current_price = quote.price
            if current_price is not None:
                market_value = (qty * current_price).quantize(Decimal("0.0001"))
                pnl = (market_value - (qty * avg_cost)).quantize(Decimal("0.0001"))

        snapshots.append(
            HoldingSnapshot(
                symbol=symbol,
                name=stock.name if stock else symbol,
                quantity=qty,
                average_cost=avg_cost.quantize(Decimal("0.0001")),
                current_price=current_price,
                market_value=market_value,
                unrealized_pnl=pnl,
            )
        )

    return snapshots


def compute_total(portfolio: Portfolio) -> PortfolioTotal:
    """Return cash + sum(holding market value) using the latest known prices.

    ``prices_stale`` is True if any holding could not be priced fresh
    (cache TTL exceeded and external fetch failed). The endpoint still
    returns the best-effort number; the flag lets the client warn the user.
    """
    holdings = compute_holdings(portfolio)
    holdings_value = ZERO
    prices_stale = False
    for h in holdings:
        if h.market_value is None:
            prices_stale = True
            continue
        holdings_value += h.market_value

    holdings_value = holdings_value.quantize(Decimal("0.0001"))
    total = (portfolio.cash_balance + holdings_value).quantize(Decimal("0.0001"))
    return PortfolioTotal(
        cash_balance=portfolio.cash_balance,
        holdings_value=holdings_value,
        total_value=total,
        holdings=holdings,
        prices_stale=prices_stale,
    )
