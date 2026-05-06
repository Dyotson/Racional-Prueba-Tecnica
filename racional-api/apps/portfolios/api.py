"""Portfolio routes mounted at /api/me/portfolio."""
from __future__ import annotations

from ninja import Router

from apps.core.auth import token_auth
from apps.portfolios.models import Portfolio
from apps.portfolios.schemas import (
    HoldingOut,
    PortfolioOut,
    PortfolioTotalOut,
    PortfolioUpdateIn,
)
from apps.portfolios.services import (
    compute_total,
    get_portfolio,
    update_portfolio,
)

router = Router(auth=token_auth)


@router.get("", response=PortfolioOut)
def get_portfolio_view(request) -> Portfolio:
    """Get the portfolio for the authenticated user."""
    return get_portfolio(request.auth)


@router.patch("", response=PortfolioOut)
def patch_portfolio_view(request, data: PortfolioUpdateIn) -> Portfolio:
    """Update the portfolio for the authenticated user."""
    portfolio = get_portfolio(request.auth)
    return update_portfolio(portfolio, **data.dict(exclude_unset=True))


@router.get("/total", response=PortfolioTotalOut)
def total_view(request) -> PortfolioTotalOut:
    """Get the total portfolio for the authenticated user."""
    portfolio = get_portfolio(request.auth)
    snapshot = compute_total(portfolio)
    return PortfolioTotalOut(
        cash_balance=snapshot.cash_balance,
        holdings_value=snapshot.holdings_value,
        total_value=snapshot.total_value,
        prices_stale=snapshot.prices_stale,
        holdings=[HoldingOut(**h.__dict__) for h in snapshot.holdings],
    )
