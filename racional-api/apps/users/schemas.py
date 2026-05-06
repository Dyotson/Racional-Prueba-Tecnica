"""Pydantic schemas for the users API.

Schemas are kept separate from views/services so they double as API
documentation (django-ninja exposes them in OpenAPI) and as the typed
contract between the layers.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from ninja import Schema
from pydantic import EmailStr, Field


class RegisterIn(Schema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(default="", max_length=80)
    last_name: str = Field(default="", max_length=80)
    document_id: str = Field(default="", max_length=40)
    phone: str = Field(default="", max_length=40)


class LoginIn(Schema):
    email: EmailStr
    password: str


class TokenOut(Schema):
    token: str
    user_id: uuid.UUID
    email: EmailStr


class UserOut(Schema):
    id: uuid.UUID
    email: EmailStr
    first_name: str
    last_name: str
    document_id: str
    phone: str
    created_at: datetime


class UserUpdateIn(Schema):
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    document_id: str | None = Field(default=None, max_length=40)
    phone: str | None = Field(default=None, max_length=40)
