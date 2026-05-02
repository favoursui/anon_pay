"""
Business logic for user registration, profile management,
and the privacy-critical username → wallet resolution.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import decrypt_wallet, encrypt_wallet
from app.models import User
from app.schemas import UserRegisterRequest, UserUpdateRequest

logger = get_logger(__name__)


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    #  Registration 

    async def register(self, privy_did: str, req: UserRegisterRequest) -> User:
        """
        Create a new user.
        wallet_address is encrypted immediately — plaintext is never persisted.
        """
        # Idempotency: if this DID already exists, return existing row
        existing = await self.get_by_privy_did(privy_did)
        if existing:
            logger.info("register called for existing privy_did=%s — returning existing", privy_did[:12])
            return existing

        # Username uniqueness
        if await self.get_by_username(req.username):
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{req.username}' is already taken.",
            )

        encrypted = encrypt_wallet(req.wallet_address)
        user = User(
            privy_did=privy_did,
            username=req.username,
            encrypted_wallet=encrypted,
            display_name=req.display_name,
            avatar_url=req.avatar_url,
            bio=req.bio,
        )
        self.db.add(user)
        await self.db.flush()
        logger.info("New user registered: @%s (privy=%s…)", user.username, privy_did[:12])
        return user

    #  Reads 

    async def get_by_privy_did(self, privy_did: str) -> User | None:
        result = await self.db.execute(select(User).where(User.privy_did == privy_did))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.username == username.lower())
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    #  Update 

    async def update_profile(self, user: User, req: UserUpdateRequest) -> User:
        if req.display_name is not None:
            user.display_name = req.display_name
        if req.avatar_url is not None:
            user.avatar_url = req.avatar_url
        if req.bio is not None:
            user.bio = req.bio
        await self.db.flush()
        return user

    #  Privacy-critical: username → wallet resolution 

    async def resolve_wallet(self, username: str) -> str:
        """
        Decrypt and return wallet address for a given username.
        MUST be called only server-side during a payment flow.
        Result is NEVER logged, cached, or included in any API response
        except the ResolveResponse sent exclusively to the paying user.
        """
        user = await self.get_by_username(username)
        if user is None:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Username not found.")
        if not user.is_active:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive.")

        wallet = decrypt_wallet(user.encrypted_wallet)
        # Intentionally NOT logged
        return wallet

    #  Deactivate 

    async def deactivate(self, user: User) -> User:
        user.is_active = False
        await self.db.flush()
        logger.warning("User deactivated: @%s", user.username)
        return user