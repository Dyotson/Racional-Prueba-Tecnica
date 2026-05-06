"""End-to-end API tests.

These are intentionally narrow: one happy-path flow that exercises every
endpoint required by the spec, plus a couple of focused error-path
checks. The detailed business-rule coverage lives in test_services.py.
"""
from __future__ import annotations

import json
from datetime import date

import pytest


pytestmark = pytest.mark.django_db


def test_full_flow(client, seeded_stocks) -> None:
    # Register
    resp = client.post(
        "/api/auth/register",
        data=json.dumps(
            {
                "email": "bob@example.com",
                "password": "StrongPass!1234",
                "first_name": "Bob",
                "last_name": "Builder",
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.content
    token = resp.json()["token"]
    auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    # GET /me returns Bob
    resp = client.get("/api/me", **auth)
    assert resp.status_code == 200
    assert resp.json()["email"] == "bob@example.com"

    # PATCH /me updates phone
    resp = client.patch(
        "/api/me",
        data=json.dumps({"phone": "+5491100000000"}),
        content_type="application/json",
        **auth,
    )
    assert resp.status_code == 200
    assert resp.json()["phone"] == "+5491100000000"

    # PATCH /me/portfolio updates name
    resp = client.patch(
        "/api/me/portfolio",
        data=json.dumps({"name": "Aggressive"}),
        content_type="application/json",
        **auth,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Aggressive"

    # Deposit 5000
    resp = client.post(
        "/api/transactions/deposit",
        data=json.dumps({"amount": "5000", "transaction_date": str(date.today())}),
        content_type="application/json",
        **auth,
    )
    assert resp.status_code == 201, resp.content

    # Buy 10 AAPL @ 100 -> spend 1000
    resp = client.post(
        "/api/orders/buy",
        data=json.dumps({"symbol": "AAPL", "quantity": "10"}),
        content_type="application/json",
        **auth,
    )
    assert resp.status_code == 201, resp.content

    # Total
    resp = client.get("/api/me/portfolio/total", **auth)
    assert resp.status_code == 200
    body = resp.json()
    assert body["cash_balance"] == "4000.0000"
    assert body["holdings_value"] == "1000.0000"
    assert body["total_value"] == "5000.0000"
    assert body["holdings"][0]["symbol"] == "AAPL"

    # Movements
    resp = client.get("/api/me/movements", **auth)
    assert resp.status_code == 200
    items = resp.json()["items"]
    kinds = {m["kind"] for m in items}
    assert kinds == {"DEPOSIT", "BUY"}


def test_unauthenticated_requests_rejected(client) -> None:
    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_available_stocks_returns_catalog_without_external_calls(
    client, seeded_stocks, fake_price_provider
) -> None:
    """The /available endpoint must NOT fan out to the price provider.

    We zero out the in-memory provider so any accidental call would
    surface a None price; we then verify the response still includes
    every catalog entry. ``is_stale=True`` is expected because no fresh
    fetch has happened.
    """
    fake_price_provider.prices.clear()
    resp = client.get("/api/stocks/available")
    assert resp.status_code == 200
    body = resp.json()
    symbols = {s["symbol"] for s in body}
    assert symbols == {"AAPL", "MSFT", "GOOGL"}
    assert all(s["is_stale"] is True for s in body)


def test_withdraw_more_than_balance_returns_422(client, seeded_stocks) -> None:
    resp = client.post(
        "/api/auth/register",
        data=json.dumps(
            {"email": "c@example.com", "password": "StrongPass!1234"}
        ),
        content_type="application/json",
    )
    token = resp.json()["token"]
    auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    resp = client.post(
        "/api/transactions/withdraw",
        data=json.dumps({"amount": "100", "transaction_date": str(date.today())}),
        content_type="application/json",
        **auth,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "insufficient_funds"
