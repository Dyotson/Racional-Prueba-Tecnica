from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from ninja import Schema


class StockOut(Schema):
    symbol: str
    name: str
    currency: str
    price: Decimal | None
    price_at: datetime | None
    is_stale: bool
