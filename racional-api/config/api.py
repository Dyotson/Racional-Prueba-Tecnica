"""Root django-ninja API definition.

Aggregates all routers from feature apps so each app stays decoupled and the
top level only knows about composition.
"""
from __future__ import annotations

from ninja import NinjaAPI
from pydantic import ValidationError as PydanticValidationError

from apps.core.exceptions import (
    BusinessRuleError,
    business_rule_handler,
    validation_error_handler,
)
from apps.portfolios.api import router as portfolio_router
from apps.stocks.api import router as stocks_router
from apps.transactions.api import (
    movements_router,
    orders_router,
    transactions_router,
)
from apps.users.api import me_router as user_me_router
from apps.users.api import router as auth_router

api = NinjaAPI(
    title="Investment API",
    version="1.0.0",
    description="API for investment portfolio management.",
)

# Auth endpoints (public except logout)
api.add_router("/auth", auth_router, tags=["auth"])

# /me/* groups everything tied to the authenticated user
api.add_router("/me", user_me_router, tags=["me"])
api.add_router("/me/portfolio", portfolio_router, tags=["portfolio"])
api.add_router("/me/movements", movements_router, tags=["movements"])

# Mutating endpoints
api.add_router("/transactions", transactions_router, tags=["transactions"])
api.add_router("/orders", orders_router, tags=["orders"])

# Auxiliary
api.add_router("/stocks", stocks_router, tags=["stocks"])

api.add_exception_handler(BusinessRuleError, business_rule_handler)
api.add_exception_handler(PydanticValidationError, validation_error_handler)
