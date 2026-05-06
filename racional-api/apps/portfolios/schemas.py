from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from ninja import Schema
from pydantic import Field


class PortfolioOut(Schema):
    id: uuid.UUID
    name: str
    description: str
    cash_balance: Decimal
    created_at: datetime
    updated_at: datetime


class PortfolioUpdateIn(Schema):
    name: str | None = Field(default=None, max_length=120)
    description: str | None = None


class HoldingOut(Schema):
    symbol: str
    name: str
    quantity: Decimal
    average_cost: Decimal
    current_price: Decimal | None
    market_value: Decimal | None
    unrealized_pnl: Decimal | None


class PortfolioTotalOut(Schema):
    cash_balance: Decimal
    holdings_value: Decimal
    total_value: Decimal
    holdings: list[HoldingOut]
    prices_stale: bool = Field(
        description=(
            "True when at least one holding is priced from a stale cache "
            "(e.g. yfinance unreachable)."
        ),
    )
