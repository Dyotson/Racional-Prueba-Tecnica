"""Token-based authentication for django-ninja routers.

Clients send ``Authorization: Token <key>``. The bearer looks up the token
and attaches the authenticated user to ``request.auth``. Routers that need
the user can read it from there with full type safety:

    @router.get("/me")
    def me(request) -> UserOut:
        user: User = request.auth
        ...
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from ninja.security import HttpBearer

if TYPE_CHECKING:
    from django.http import HttpRequest

    from apps.users.models import User


class TokenAuth(HttpBearer):
    """Validate ``Authorization: Bearer <key>`` headers against AuthToken."""

    openapi_scheme: str = "bearer"

    def authenticate(self, request: "HttpRequest", token: str) -> "User | None":
        from apps.users.models import AuthToken

        if not token:
            return None
        try:
            auth_token = AuthToken.objects.select_related("user").get(key=token)
        except AuthToken.DoesNotExist:
            return None
        return auth_token.user


token_auth = TokenAuth()
