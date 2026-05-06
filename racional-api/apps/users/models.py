"""User and AuthToken models.

We use a custom User model with email-as-username because the API never
exposes a "username" field (the enunciado talks about ``email``). Switching
to a custom User after the project has data is painful, so we set it up
from day one.
"""
from __future__ import annotations

import secrets
import uuid
from typing import Any

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager["User"]):
    """Manager that uses ``email`` as the natural key instead of ``username``."""

    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields: Any) -> "User":
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields: Any) -> "User":
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields: Any) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=80, blank=True)
    last_name = models.CharField(max_length=80, blank=True)
    document_id = models.CharField(max_length=40, blank=True)
    phone = models.CharField(max_length=40, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


def _generate_token_key() -> str:
    """64-char URL-safe random token (~256 bits of entropy)."""
    return secrets.token_urlsafe(48)


class AuthToken(models.Model):
    """Opaque bearer token issued at login.

    A user can have many active tokens (e.g. mobile + web), so this is M:1.
    The key is indexed for O(1) lookup by the auth bearer.
    """

    key = models.CharField(max_length=128, primary_key=True, default=_generate_token_key)
    user = models.ForeignKey(
        User, related_name="auth_tokens", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user"])]

    def __str__(self) -> str:
        return f"AuthToken(user={self.user_id})"
