"""Exceptions raised from service layer and their HTTP handlers.

Services raise ``BusinessRuleError`` (or one of its subclasses) when an
operation cannot proceed because of a domain constraint. The router stays
thin: it only deserializes input, calls the service and serializes the
response. All input validation that depends on Pydantic types is handled by
django-ninja itself; input validation that requires DB state lives in the
service layer.
"""
from __future__ import annotations

from typing import Any

from django.http import HttpRequest, JsonResponse
from pydantic import ValidationError as PydanticValidationError


class BusinessRuleError(Exception):
    """A domain rule was violated.

    The HTTP handler maps this to a 422 response with a stable shape so the
    client can render the error without inspecting the message.
    """

    status_code: int = 422
    code: str = "business_rule_error"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


class InsufficientFunds(BusinessRuleError):
    code = "insufficient_funds"


class InsufficientHoldings(BusinessRuleError):
    code = "insufficient_holdings"


class StockNotAvailable(BusinessRuleError):
    code = "stock_not_available"


class InvalidCredentials(BusinessRuleError):
    status_code = 401
    code = "invalid_credentials"


class EmailAlreadyTaken(BusinessRuleError):
    status_code = 409
    code = "email_already_taken"


def business_rule_handler(
    request: HttpRequest, exc: BusinessRuleError
) -> JsonResponse:
    payload: dict[str, Any] = {"detail": exc.message, "code": exc.code}
    return JsonResponse(payload, status=exc.status_code)


def validation_error_handler(
    request: HttpRequest, exc: PydanticValidationError
) -> JsonResponse:
    return JsonResponse(
        {"detail": exc.errors(include_url=False), "code": "validation_error"},
        status=422,
    )
