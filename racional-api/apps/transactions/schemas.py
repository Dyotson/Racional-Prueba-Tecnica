from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from ninja import Schema
from pydantic import Field, field_validator


class CashTransactionIn(Schema):
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    transaction_date: date

    @field_validator("amount")
    @classmethod
    def _round(cls, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.0001"))


class CashTransactionOut(Schema):
    id: uuid.UUID
    kind: Literal["DEPOSIT", "WITHDRAWAL"]
    amount: Decimal
    transaction_date: date
    created_at: datetime


class OrderIn(Schema):
    symbol: str = Field(min_length=1, max_length=20)
    quantity: Decimal = Field(gt=0, max_digits=20, decimal_places=8)


class OrderOut(Schema):
    id: uuid.UUID
    symbol: str
    side: Literal["BUY", "SELL"]
    quantity: Decimal
    price: Decimal
    total: Decimal
    executed_at: datetime
    created_at: datetime


class MovementOut(Schema):
    """Unified movement entry for /me/movements.

    ``kind`` is one of:
    - ``DEPOSIT`` / ``WITHDRAWAL``: from CashTransaction
    - ``BUY`` / ``SELL``: from Order
    The other fields are populated as available.
    """

    id: uuid.UUID
    kind: Literal["DEPOSIT", "WITHDRAWAL", "BUY", "SELL"]
    amount: Decimal
    occurred_at: datetime
    symbol: str | None = None
    quantity: Decimal | None = None
    price: Decimal | None = None


class MovementsPage(Schema):
    items: list[MovementOut]
    limit: int
    offset: int
    total: int

class MovementsQuery(Schema):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

