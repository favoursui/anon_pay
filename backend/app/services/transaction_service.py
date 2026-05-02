"""
Orchestrates the full send-payment flow:
  1. Resolve recipient username → wallet (server-side, private)
  2. Create pending Transaction log row
  3. Return resolved wallet to caller so client can sign & broadcast
  4. Confirm: verify on-chain and update status
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models import Transaction, TxChain, TxStatus, User
from app.schemas import SendPaymentRequest
from app.services.blockchain_service import BlockchainService
from app.services.user_service import UserService

logger = get_logger(__name__)


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._bc = BlockchainService()

    #  Initiate payment 

    async def initiate_payment(
        self,
        sender: User,
        req: SendPaymentRequest,
    ) -> tuple[Transaction, str]:
        """
        Returns (pending_tx_row, recipient_wallet_address).
        The caller (endpoint) returns wallet_address to the client
        for signing — it is NEVER stored in the DB.
        """
        user_svc = UserService(self.db)

        # Privacy-critical: resolve wallet server-side only
        recipient_wallet = await user_svc.resolve_wallet(req.recipient_username)
        recipient = await user_svc.get_by_username(req.recipient_username)

        # Resolve optional payment link
        link_id: str | None = None
        if req.payment_link_slug:
            result = await self.db.execute(
                select(Transaction.__table__.c.id)  # just check existence
            )
            from app.models import PaymentLink
            pl_result = await self.db.execute(
                select(PaymentLink).where(PaymentLink.slug == req.payment_link_slug)
            )
            pl = pl_result.scalar_one_or_none()
            if pl:
                link_id = pl.id

        chain = TxChain(req.chain)
        tx = Transaction(
            sender_user_id=sender.id,
            recipient_user_id=recipient.id,
            payment_link_id=link_id,
            amount_usdc=req.amount_usdc,
            chain=chain,
            status=TxStatus.PENDING,
            note=req.note,
        )
        self.db.add(tx)
        await self.db.flush()

        logger.info(
            "Payment initiated: tx=%s sender=@%s recipient=@%s amount=%s %s",
            tx.id[:8], sender.username, req.recipient_username, req.amount_usdc, chain.value,
        )
        # Return wallet to endpoint — endpoint passes it to client for signing
        return tx, recipient_wallet

    #  Confirm (post-broadcast) 

    async def confirm_payment(
        self,
        tx_id: str,
        tx_hash: str,
        sender: User,
    ) -> Transaction:
        """
        Called after the client has broadcast the transaction.
        Verifies on-chain and updates status.
        """
        tx = await self._get_tx(tx_id)
        if tx is None or tx.sender_user_id != sender.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

        if tx.status != TxStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Transaction is already {tx.status.value}.",
            )

        # Resolve recipient wallet for verification
        user_svc = UserService(self.db)
        recipient_wallet = await user_svc.resolve_wallet(tx.recipient.username)

        confirmed = await self._bc.verify_transfer(
            tx_hash,
            expected_recipient=recipient_wallet,
            expected_amount_usdc=tx.amount_usdc,
            chain=tx.chain.value,
        )

        if confirmed:
            tx.status = TxStatus.CONFIRMED
            tx.tx_hash = tx_hash
            tx.confirmed_at = datetime.now(timezone.utc)
            logger.info("Transaction confirmed: tx=%s hash=%s", tx.id[:8], tx_hash[:12])
        else:
            tx.status = TxStatus.FAILED
            tx.tx_hash = tx_hash
            logger.warning("Transaction verification failed: tx=%s hash=%s", tx.id[:8], tx_hash[:12])

        await self.db.flush()
        return tx

    #  History 

    async def get_history(
        self,
        user: User,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transaction], int]:
        from sqlalchemy import func, or_

        base_q = (
            select(Transaction)
            .where(
                or_(
                    Transaction.sender_user_id == user.id,
                    Transaction.recipient_user_id == user.id,
                )
            )
            .options(
                selectinload(Transaction.sender),
                selectinload(Transaction.recipient),
            )
            .order_by(Transaction.created_at.desc())
        )

        count_q = select(func.count()).select_from(base_q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        result = await self.db.execute(
            base_q.offset((page - 1) * page_size).limit(page_size)
        )
        txs = list(result.scalars().all())
        return txs, total

    #  Internal 

    async def _get_tx(self, tx_id: str) -> Transaction | None:
        result = await self.db.execute(
            select(Transaction)
            .where(Transaction.id == tx_id)
            .options(
                selectinload(Transaction.sender),
                selectinload(Transaction.recipient),
            )
        )
        return result.scalar_one_or_none()