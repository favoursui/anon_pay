"""
User registration, profile, and username resolution endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import PrivyUser, verify_privy_token
from app.db.session import get_db
from app.schemas import (
    MessageResponse,
    ResolveResponse,
    UserPrivateResponse,
    UserPublicResponse,
    UserRegisterRequest,
    UserUpdateRequest,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


#  Register 

@router.post(
    "/register",
    response_model=UserPrivateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register username + encrypted wallet",
)
async def register_user(
    req: UserRegisterRequest,
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Registers the authenticated Privy user with a chosen username.
    The wallet address is encrypted immediately and the plaintext
    is never stored or returned after this call.
    """
    svc = UserService(db)
    user = await svc.register(privy_user.privy_did, req)
    return _to_private(user)


#  Me 

@router.get("/me", response_model=UserPrivateResponse, summary="Get own profile")
async def get_me(
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_by_privy_did(privy_user.privy_did)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not registered.")
    return _to_private(user)


@router.patch("/me", response_model=UserPrivateResponse, summary="Update own profile")
async def update_me(
    req: UserUpdateRequest,
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_by_privy_did(privy_user.privy_did)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not registered.")
    user = await svc.update_profile(user, req)
    return _to_private(user)


@router.delete("/me", response_model=MessageResponse, summary="Deactivate own account")
async def deactivate_me(
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_by_privy_did(privy_user.privy_did)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not registered.")
    await svc.deactivate(user)
    return {"message": "Account deactivated."}


#  Public profile 

@router.get(
    "/{username}",
    response_model=UserPublicResponse,
    summary="Public profile (no wallet)",
)
async def get_public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Publicly accessible — returns display info only.
    Wallet address is never included in this response.
    """
    svc = UserService(db)
    user = await svc.get_by_username(username)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _to_public(user)


#  Server-side wallet resolution (authenticated senders only) 

@router.get(
    "/{username}/resolve",
    response_model=ResolveResponse,
    summary="Resolve username → wallet (authenticated, payment flow only)",
)
async def resolve_wallet(
    username: str,
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the wallet address for `username`.
    Caller must be authenticated. Result is for one-time use in the
    payment signing flow — the client must NOT cache or store it.
    """
    svc = UserService(db)
    wallet = await svc.resolve_wallet(username)
    return ResolveResponse(username=username, wallet_address=wallet)


#  Helpers 

def _to_public(user) -> UserPublicResponse:
    return UserPublicResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
    )


def _to_private(user) -> UserPrivateResponse:
    return UserPrivateResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
        privy_did=user.privy_did,
        is_active=user.is_active,
        updated_at=user.updated_at,
    )