"""Auto-provision a Portfolio for every new User.

This keeps the 1:1 invariant in the data model: the rest of the codebase
can rely on ``user.portfolio`` always existing without scattering
``get_or_create`` calls everywhere.
"""
from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.portfolios.models import Portfolio
from apps.users.models import User


@receiver(post_save, sender=User)
def create_portfolio_for_user(
    sender: type[User], instance: User, created: bool, **kwargs: object
) -> None:
    if not created:
        return
    Portfolio.objects.get_or_create(
        user=instance,
        defaults={"name": "My portfolio"},
    )
