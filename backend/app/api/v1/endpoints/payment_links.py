"""
CRUD for shareable /pay/<slug> pages.
"""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import PrivyUser, verify_privy_token
from app.db.session import get_db
from app.schemas import (
    MessageResponse,
    PaymentLinkCreateRequest,
    PaymentLinkResponse,
    PaymentLinkUpdateRequest,
)
from app.services.payment_link_service import PaymentLinkService
from app.services.user_service import UserService

router = APIRouter(prefix="/payment-links", tags=["Payment Links"])


#  Create 

@router.post(
    "",
    response_model=PaymentLinkResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a shareable payment link",
)
async def create_link(
    req: PaymentLinkCreateRequest,
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    owner = await _require_user(privy_user.privy_did, db)
    svc = PaymentLinkService(db)
    link = await svc.create(owner, req)
    return _to_response(link, owner.username)


#  List own 

@router.get(
    "",
    response_model=list[PaymentLinkResponse],
    summary="List all payment links for authenticated user",
)
async def list_links(
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    owner = await _require_user(privy_user.privy_did, db)
    svc = PaymentLinkService(db)
    links = await svc.list_for_owner(owner)
    return [_to_response(lnk, owner.username) for lnk in links]


#  Get public (no auth) 

@router.get(
    "/{slug}",
    response_model=PaymentLinkResponse,
    summary="Fetch an active payment link (public)",
)
async def get_link(
    slug: str = Path(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Publicly accessible for rendering a payment page in the frontend.
    Wallet address is never included — only username and link metadata.
    """
    svc = PaymentLinkService(db)
    link = await svc.get_by_slug_active(slug)
    owner_username = link.owner.username if link.owner else "unknown"
    return _to_response(link, owner_username)


#  Update 

@router.patch(
    "/{slug}",
    response_model=PaymentLinkResponse,
    summary="Update a payment link",
)
async def update_link(
    req: PaymentLinkUpdateRequest,
    slug: str = Path(...),
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    owner = await _require_user(privy_user.privy_did, db)
    svc = PaymentLinkService(db)
    link = await svc.update(owner, slug, req)
    return _to_response(link, owner.username)


#  Delete 

@router.delete(
    "/{slug}",
    response_model=MessageResponse,
    summary="Delete a payment link",
)
async def delete_link(
    slug: str = Path(...),
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    owner = await _require_user(privy_user.privy_did, db)
    svc = PaymentLinkService(db)
    await svc.delete(owner, slug)
    return {"message": f"Payment link '{slug}' deleted."}


#  Helpers 

async def _require_user(privy_did: str, db):
    from app.services.user_service import UserService
    user = await UserService(db).get_by_privy_did(privy_did)
    if user is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not registered.")
    return user


def _to_response(link, owner_username: str) -> PaymentLinkResponse:
    return PaymentLinkResponse(
        id=link.id,
        slug=link.slug,
        owner_username=owner_username,
        amount_usdc=link.amount_usdc,
        note=link.note,
        is_active=link.is_active,
        expires_at=link.expires_at,
        created_at=link.created_at,
    )