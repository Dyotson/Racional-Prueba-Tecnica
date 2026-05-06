"""Auth + /me routes."""
from __future__ import annotations

from ninja import Router

from apps.core.auth import token_auth
from apps.users.models import User
from apps.users.schemas import (
    LoginIn,
    RegisterIn,
    TokenOut,
    UserOut,
    UserUpdateIn,
)
from apps.users.services import authenticate, register_user, revoke_token, update_user

router = Router()


@router.post("/register", response={201: TokenOut})
def register(request, data: RegisterIn) -> tuple[int, TokenOut]:
    user, token = register_user(data)
    return 201, TokenOut(token=token.key, user_id=user.id, email=user.email)


@router.post("/login", response=TokenOut)
def login(request, data: LoginIn) -> TokenOut:
    user, token = authenticate(data.email, data.password)
    return TokenOut(token=token.key, user_id=user.id, email=user.email)


@router.post("/logout", auth=token_auth, response={204: None})
def logout(request) -> tuple[int, None]:
    auth_header = request.headers.get("Authorization", "")
    _, _, raw_token = auth_header.partition(" ")
    revoke_token(raw_token.strip())
    return 204, None


# /me endpoints are exposed under a separate prefix in config.api but stay
# in this module because they conceptually belong to "the authenticated
# user". Routers can be composed at the api level.
me_router = Router(auth=token_auth)


@me_router.get("", response=UserOut)
def get_me(request) -> User:
    return request.auth


@me_router.patch("", response=UserOut)
def patch_me(request, data: UserUpdateIn) -> User:
    return update_user(request.auth, **data.dict(exclude_unset=True))
