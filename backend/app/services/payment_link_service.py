"""
CRUD for payment links.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models import PaymentLink, User
from app.schemas import PaymentLinkCreateRequest, PaymentLinkUpdateRequest

logger = get_logger(__name__)


class PaymentLinkService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, owner: User, req: PaymentLinkCreateRequest) -> PaymentLink:
        # Slug uniqueness
        existing = await self._get_by_slug(req.slug)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use.")

        link = PaymentLink(
            slug=req.slug,
            owner_id=owner.id,
            amount_usdc=req.amount_usdc,
            note=req.note,
            expires_at=req.expires_at,
        )
        self.db.add(link)
        await self.db.flush()
        logger.info("PaymentLink created: slug=%s owner=@%s", link.slug, owner.username)
        return link

    async def get_by_slug_active(self, slug: str) -> PaymentLink:
        """Returns link only if active and not expired."""
        link = await self._get_by_slug(slug, eager_owner=True)
        if link is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found.")
        if not link.is_active:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Payment link is inactive.")
        if link.expires_at and link.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Payment link has expired.")
        return link

    async def list_for_owner(self, owner: User) -> list[PaymentLink]:
        result = await self.db.execute(
            select(PaymentLink)
            .where(PaymentLink.owner_id == owner.id)
            .order_by(PaymentLink.created_at.desc())
        )
        return list(result.scalars().all())

    async def update(self, owner: User, slug: str, req: PaymentLinkUpdateRequest) -> PaymentLink:
        link = await self._get_by_slug(slug)
        if link is None or link.owner_id != owner.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found.")

        if req.amount_usdc is not None:
            link.amount_usdc = req.amount_usdc
        if req.note is not None:
            link.note = req.note
        if req.is_active is not None:
            link.is_active = req.is_active
        if req.expires_at is not None:
            link.expires_at = req.expires_at

        await self.db.flush()
        return link

    async def delete(self, owner: User, slug: str) -> None:
        link = await self._get_by_slug(slug)
        if link is None or link.owner_id != owner.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found.")
        await self.db.delete(link)
        await self.db.flush()
        logger.info("PaymentLink deleted: slug=%s", slug)

    #  Internal 

    async def _get_by_slug(
        self, slug: str, *, eager_owner: bool = False
    ) -> PaymentLink | None:
        q = select(PaymentLink).where(PaymentLink.slug == slug)
        if eager_owner:
            q = q.options(selectinload(PaymentLink.owner))
        result = await self.db.execute(q)
        return result.scalar_one_or_none()