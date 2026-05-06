"""Service layer for the users app.

Routers must call into these functions instead of touching the ORM
directly. Keeping all writes here makes it trivial to (a) wrap them in a
single transaction, (b) re-use them from management commands or tests,
and (c) raise typed business errors that the API layer maps to HTTP.
"""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction

from apps.core.exceptions import (
    BusinessRuleError,
    EmailAlreadyTaken,
    InvalidCredentials,
)
from apps.users.models import AuthToken, User
from apps.users.schemas import RegisterIn


@transaction.atomic
def register_user(data: RegisterIn) -> tuple[User, AuthToken]:
    """Create a User (and via signal a Portfolio) and issue a token.

    Wrapped in ``atomic`` so that if token creation fails for any reason
    the half-created user is rolled back.
    """
    try:
        validate_password(data.password)
    except DjangoValidationError as exc:
        raise BusinessRuleError(
            "; ".join(exc.messages), code="weak_password"
        ) from exc

    try:
        user = User.objects.create_user(
            email=data.email,
            password=data.password,
            first_name=data.first_name,
            last_name=data.last_name,
            document_id=data.document_id,
            phone=data.phone,
        )
    except IntegrityError as exc:
        raise EmailAlreadyTaken("Email is already registered.") from exc

    token = AuthToken.objects.create(user=user)
    return user, token


def authenticate(email: str, password: str) -> tuple[User, AuthToken]:
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist as exc:
        raise InvalidCredentials("Invalid email or password.") from exc
    if not user.check_password(password):
        raise InvalidCredentials("Invalid email or password.")
    if not user.is_active:
        raise InvalidCredentials("User is inactive.")
    token = AuthToken.objects.create(user=user)
    return user, token


def revoke_token(token_key: str) -> None:
    AuthToken.objects.filter(key=token_key).delete()


def update_user(user: User, **fields: str | None) -> User:
    """Patch the editable user fields, ignoring keys whose value is None."""
    changed = False
    for field, value in fields.items():
        if value is None:
            continue
        setattr(user, field, value)
        changed = True
    if changed:
        user.save()
    return user
