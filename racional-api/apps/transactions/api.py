"""Routers for transactions, orders and the unified movements feed.

Three routers are exposed because they live under different URL prefixes
(see ``config/api.py``):
- ``transactions_router`` -> /api/transactions/{deposit,withdraw}
- ``orders_router``       -> /api/orders/{buy,sell}
- ``movements_router``    -> /api/me/movements

IMPORTANT: All the functions and models asumed the usage of USD as the currency.
"""
from __future__ import annotations

from ninja import Query, Router, Schema
from pydantic import Field

from apps.core.auth import token_auth
from apps.transactions.models import Order
from apps.transactions.schemas import (
    CashTransactionIn,
    CashTransactionOut,
    MovementOut,
    MovementsPage,
    OrderIn,
    OrderOut,
    MovementsQuery,
)
from apps.transactions.services import (
    deposit,
    list_movements,
    place_buy,
    place_sell,
    withdraw,
)

transactions_router = Router(auth=token_auth)
orders_router = Router(auth=token_auth)
movements_router = Router(auth=token_auth)


@transactions_router.post("/deposit", response={201: CashTransactionOut})
def deposit_view(request, data: CashTransactionIn):
    """Deposit money into the portfolio."""
    tx = deposit(
        request.auth,
        amount=data.amount,
        transaction_date=data.transaction_date,
    )
    return 201, tx


@transactions_router.post("/withdraw", response={201: CashTransactionOut})
def withdraw_view(request, data: CashTransactionIn):
    """Withdraw money from the portfolio."""
    tx = withdraw(
        request.auth,
        amount=data.amount,
        transaction_date=data.transaction_date,
    )
    return 201, tx


@orders_router.post("/buy", response={201: OrderOut})
def buy_view(request, data: OrderIn):
    """Buy an amount of stocks. (Quantity of stocks, not amount of money)"""
    # NOTE: Used "how much stocks you want to buy" instead of "how much money you want to use".
    # This was because it's safer for the backend to receive the quantity of stocks to buy instead 
    # of the amount of money to use. (Avoiding floating point errors and rounding errors, those can run in frontend)
    order = place_buy(request.auth, symbol=data.symbol, quantity=data.quantity)
    return 201, _order_to_schema(order)


@orders_router.post("/sell", response={201: OrderOut})
def sell_view(request, data: OrderIn):
    """Sell an amount of stocks. (Quantity of stocks, not amount of money)"""
    # NOTE: The last note about the quantity of stocks to buy also applies to the quantity of stocks to sell.
    order = place_sell(request.auth, symbol=data.symbol, quantity=data.quantity)
    return 201, _order_to_schema(order)



@movements_router.get("", response=MovementsPage)
def movements_view(request, filters: Query[MovementsQuery]):
    """List all movements in the portfolio."""
    items, total = list_movements(
        request.auth, limit=filters.limit, offset=filters.offset
    )
    return MovementsPage(
        items=[MovementOut(**i) for i in items],
        limit=filters.limit,
        offset=filters.offset,
        total=total,
    )


def _order_to_schema(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        symbol=order.symbol,
        side=order.side,
        quantity=order.quantity,
        price=order.price,
        total=order.quantity * order.price,
        executed_at=order.executed_at,
        created_at=order.created_at,
    )
