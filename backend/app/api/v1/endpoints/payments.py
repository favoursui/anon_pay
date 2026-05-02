"""
Send USDC, confirm on-chain, and view history.
"""
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import PrivyUser, verify_privy_token
from app.db.session import get_db
from app.schemas import (
    ConfirmTransactionRequest,
    MessageResponse,
    PaginatedResponse,
    SendPaymentRequest,
    TransactionResponse,
)
from app.services.transaction_service import TransactionService
from app.services.user_service import UserService

router = APIRouter(prefix="/payments", tags=["Payments"])


#  Initiate 

@router.post(
    "/send",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Initiate USDC payment (returns recipient wallet for client signing)",
)
async def initiate_payment(
    req: SendPaymentRequest,
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Privacy flow:
      1. Server resolves recipient username → wallet (never logged)
      2. Creates a PENDING transaction row (username FKs only, no addresses)
      3. Returns `{ tx_id, recipient_wallet }` so the client can sign & broadcast
         — wallet address lives only in this response, never in the DB
    """
    svc_user = UserService(db)
    sender = await svc_user.get_by_privy_did(privy_user.privy_did)
    if sender is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sender not registered.")

    tx_svc = TransactionService(db)
    tx, recipient_wallet = await tx_svc.initiate_payment(sender, req)

    return {
        "tx_id": tx.id,
        "recipient_wallet": recipient_wallet,   # ← client uses this to sign the tx
        "amount_usdc": str(tx.amount_usdc),
        "chain": tx.chain.value,
        "status": tx.status.value,
    }


#  Confirm 

@router.post(
    "/{tx_id}/confirm",
    response_model=TransactionResponse,
    summary="Submit on-chain tx_hash and confirm payment",
)
async def confirm_payment(
    req: ConfirmTransactionRequest,
    tx_id: str = Path(...),
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    """
    After the client signs and broadcasts, POST the tx_hash here.
    The server verifies the on-chain Transfer event and updates status.
    """
    svc_user = UserService(db)
    sender = await svc_user.get_by_privy_did(privy_user.privy_did)
    if sender is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sender not registered.")

    tx_svc = TransactionService(db)
    tx = await tx_svc.confirm_payment(tx_id, req.tx_hash, sender)
    return _to_response(tx)


#  History 

@router.get(
    "/history",
    response_model=PaginatedResponse,
    summary="Paginated transaction history for authenticated user",
)
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    privy_user: PrivyUser = Depends(verify_privy_token),
    db: AsyncSession = Depends(get_db),
):
    svc_user = UserService(db)
    user = await svc_user.get_by_privy_did(privy_user.privy_did)
    if user is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not registered.")

    tx_svc = TransactionService(db)
    txs, total = await tx_svc.get_history(user, page=page, page_size=page_size)

    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_to_response(tx) for tx in txs],
    )


#  Helper 

def _to_response(tx) -> TransactionResponse:
    sender_username = tx.sender.username if tx.sender else None
    recipient_username = tx.recipient.username if tx.recipient else "unknown"
    return TransactionResponse(
        id=tx.id,
        sender_username=sender_username,
        recipient_username=recipient_username,
        amount_usdc=tx.amount_usdc,
        chain=tx.chain.value,
        status=tx.status.value,
        tx_hash=tx.tx_hash,
        note=tx.note,
        created_at=tx.created_at,
        confirmed_at=tx.confirmed_at,
    )