"""
ORM models for AnonPay.

Index strategy — pick ONE of:
index=True / unique=True on the Column  (SQLAlchemy auto-names it)
explicit Index() in __table_args__       (for composite or named indexes)
Never both for the same column — Postgres will reject the duplicate name.
"""
from __future__ import annotations

import enum as py_enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    # unique=True already creates an index; do NOT add Index() for these in __table_args__
    privy_did     = Column(String(128), nullable=False, unique=True)
    username      = Column(String(32),  nullable=False, unique=True)
    encrypted_wallet = Column(Text, nullable=False)

    display_name  = Column(String(64),  nullable=True)
    avatar_url    = Column(Text,        nullable=True)
    bio           = Column(String(160), nullable=True)
    is_active     = Column(Boolean,     default=True, nullable=False)
    created_at    = Column(DateTime(timezone=True), default=_now,  nullable=False)
    updated_at    = Column(DateTime(timezone=True), default=_now,  onupdate=_now, nullable=False)

    payment_links = relationship("PaymentLink", back_populates="owner", cascade="all, delete-orphan")
    sent_transactions = relationship(
        "Transaction", foreign_keys="Transaction.sender_user_id", back_populates="sender"
    )
    received_transactions = relationship(
        "Transaction", foreign_keys="Transaction.recipient_user_id", back_populates="recipient"
    )

    # unique=True on privy_did/username already makes unique indexes;
    # no extra Index() needed here.
    __table_args__ = ()

    def __repr__(self) -> str:
        return f"<User @{self.username}>"


# ── Payment Links ─────────────────────────────────────────────────────────────

class PaymentLink(Base):
    __tablename__ = "payment_links"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    # unique=True creates the index; remove the duplicate Index() from __table_args__
    slug       = Column(String(64), nullable=False, unique=True)
    owner_id   = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    amount_usdc = Column(Numeric(precision=28, scale=6), nullable=True)
    note        = Column(String(280), nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)
    expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at  = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    owner        = relationship("User", back_populates="payment_links")
    transactions = relationship("Transaction", back_populates="payment_link")

    # Only index owner_id (FK lookup) — slug already has a unique index above
    __table_args__ = (
        Index("ix_payment_links_owner_id", "owner_id"),
    )

    def __repr__(self) -> str:
        return f"<PaymentLink slug={self.slug}>"


# ── Transactions ──────────────────────────────────────────────────────────────

class TxStatus(str, py_enum.Enum):
    PENDING   = "pending"
    CONFIRMED = "confirmed"
    FAILED    = "failed"


class TxChain(str, py_enum.Enum):
    BASE = "base"
    ARC  = "arc"


class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    sender_user_id   = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"),    nullable=True)
    recipient_user_id= Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"),    nullable=False)
    payment_link_id  = Column(UUID(as_uuid=False), ForeignKey("payment_links.id", ondelete="SET NULL"), nullable=True)

    # index=True here — no matching Index() in __table_args__
    tx_hash    = Column(String(66), nullable=True, index=True)
    chain      = Column(Enum(TxChain),   nullable=False, default=TxChain.BASE)
    amount_usdc= Column(Numeric(precision=28, scale=6), nullable=False)
    status     = Column(Enum(TxStatus),  nullable=False, default=TxStatus.PENDING)
    note       = Column(String(280),     nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    sender       = relationship("User", foreign_keys=[sender_user_id],    back_populates="sent_transactions")
    recipient    = relationship("User", foreign_keys=[recipient_user_id], back_populates="received_transactions")
    payment_link = relationship("PaymentLink", back_populates="transactions")

    # FK lookup indexes only — tx_hash already indexed via index=True above
    __table_args__ = (
        Index("ix_transactions_recipient_id", "recipient_user_id"),
        Index("ix_transactions_sender_id",    "sender_user_id"),
    )

    def __repr__(self) -> str:
        return f"<Transaction {self.id[:8]}… {self.amount_usdc} USDC {self.status}>"