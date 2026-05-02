"""
All Pydantic v2 request / response models.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


#  User schemas

USERNAME_PATTERN = r"^[a-z0-9_]{3,32}$"


class UserRegisterRequest(BaseModel):
    username: str = Field(..., pattern=USERNAME_PATTERN, description="3-32 lowercase alphanumeric / underscore")
    wallet_address: str = Field(..., description="EVM wallet address (0x…). Encrypted server-side immediately.")
    display_name: Optional[str] = Field(None, max_length=64)
    avatar_url: Optional[str] = Field(None, max_length=512)
    bio: Optional[str] = Field(None, max_length=160)

    @field_validator("wallet_address")
    @classmethod
    def validate_evm(cls, v: str) -> str:
        if not v.startswith("0x") or len(v) != 42:
            raise ValueError("wallet_address must be a 42-char EVM address starting with 0x")
        return v.lower()


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=64)
    avatar_url: Optional[str] = Field(None, max_length=512)
    bio: Optional[str] = Field(None, max_length=160)


class UserPublicResponse(BaseModel):
    """Safe to return to ANY caller — wallet address is NEVER included."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    created_at: datetime


class UserPrivateResponse(UserPublicResponse):
    """Returned only to the authenticated owner — still no wallet."""
    privy_did: str
    is_active: bool
    updated_at: datetime


#  Payment Link schemas

class PaymentLinkCreateRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-z0-9\-_]{3,64}$")
    amount_usdc: Optional[Decimal] = Field(None, ge=Decimal("0.000001"), description="Fixed amount; omit for open")
    note: Optional[str] = Field(None, max_length=280)
    expires_at: Optional[datetime] = None


class PaymentLinkUpdateRequest(BaseModel):
    amount_usdc: Optional[Decimal] = Field(None, ge=Decimal("0.000001"))
    note: Optional[str] = Field(None, max_length=280)
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None


class PaymentLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    owner_username: str = Field(..., description="Resolved from owner FK — wallet never exposed")
    amount_usdc: Optional[Decimal]
    note: Optional[str]
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime


#  Transaction schemas

class SendPaymentRequest(BaseModel):
    recipient_username: str = Field(..., description="Username of the recipient (wallet resolved server-side)")
    amount_usdc: Decimal = Field(..., ge=Decimal("0.000001"), description="USDC amount (6 decimals)")
    chain: str = Field("base", pattern=r"^(base|arc)$")
    note: Optional[str] = Field(None, max_length=280)
    payment_link_slug: Optional[str] = None

    @field_validator("amount_usdc")
    @classmethod
    def max_decimals(cls, v: Decimal) -> Decimal:
        if v != round(v, 6):
            raise ValueError("amount_usdc supports at most 6 decimal places")
        return v


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_username: Optional[str] = Field(None, description="Username — wallet never exposed")
    recipient_username: str
    amount_usdc: Decimal
    chain: str
    status: str
    tx_hash: Optional[str]
    note: Optional[str]
    created_at: datetime
    confirmed_at: Optional[datetime]


class ConfirmTransactionRequest(BaseModel):
    tx_hash: str = Field(..., pattern=r"^0x[0-9a-fA-F]{64}$", description="64-char hex tx hash")


#  Resolve schema  (username → wallet, server-side only)

class ResolveResponse(BaseModel):
    """Returned only to the authenticated sender during a payment flow."""
    username: str
    wallet_address: str   # Decrypted at this point — never logged or cached


#  Generic

class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list