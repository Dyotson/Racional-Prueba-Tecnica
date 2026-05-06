"""Cash transactions and stock orders.

Two ledger-style tables:
- ``CashTransaction``: deposits and withdrawals.
- ``Order``: buy/sell orders against a stock symbol.

We deliberately keep them in separate tables (instead of a single
"movements" table with a polymorphic ``kind``) because their columns
diverge: orders have ``symbol``, ``quantity``, ``price``; cash
transactions don't. The /me/movements endpoint unifies them at read
time. This is cheaper and clearer than a sparse single table.

Both tables are append-only by convention - we never update or delete
rows. The denormalized ``Portfolio.cash_balance`` is recomputed
incrementally inside the transaction services, never derived from these
tables at read time (that's an O(N) over history for every "get total"
call).
"""
from __future__ import annotations

from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel
from apps.portfolios.models import Portfolio


class CashKind(models.TextChoices):
    DEPOSIT = "DEPOSIT", "Deposit"
    WITHDRAWAL = "WITHDRAWAL", "Withdrawal"


class OrderSide(models.TextChoices):
    BUY = "BUY", "Buy"
    SELL = "SELL", "Sell"


class CashTransaction(UUIDModel, TimeStampedModel):
    portfolio = models.ForeignKey(
        Portfolio, related_name="cash_transactions", on_delete=models.CASCADE
    )
    kind = models.CharField(max_length=16, choices=CashKind.choices)
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        help_text="Always stored as a positive number; ``kind`` carries the sign.",
    )
    transaction_date = models.DateField()

    class Meta:
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["portfolio", "-transaction_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.amount} ({self.portfolio_id})"


class Order(UUIDModel, TimeStampedModel):
    portfolio = models.ForeignKey(
        Portfolio, related_name="orders", on_delete=models.CASCADE
    )
    # Plain CharField (not FK) so deleting a stock from the catalog does
    # not cascade-delete historical orders. We trade referential
    # integrity at the DB level for ledger immutability, which matters
    # more for an audit trail.
    symbol = models.CharField(max_length=20)
    side = models.CharField(max_length=8, choices=OrderSide.choices)
    quantity = models.DecimalField(max_digits=20, decimal_places=8)
    price = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        help_text="Snapshot of the unit price at execution time.",
    )
    executed_at = models.DateTimeField()

    class Meta:
        ordering = ["-executed_at", "-created_at"]
        indexes = [
            models.Index(fields=["portfolio", "-executed_at"]),
            models.Index(fields=["portfolio", "symbol"]),
        ]

    def __str__(self) -> str:
        return f"{self.side} {self.quantity} {self.symbol} @ {self.price}"

    @property
    def total(self) -> "models.DecimalField":  # type: ignore[name-defined]
        return self.quantity * self.price
