"""
Async RPC interactions with Base and ARC networks via httpx.
Handles USDC transfer verification (non-custodial: we verify only,
the client signs & broadcasts the transaction).
"""
from __future__ import annotations

import asyncio
from decimal import Decimal

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# USDC contract on Base (mainnet)
USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
# USDC contract on ARC
USDC_ARC  = "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9"

# ERC-20 Transfer event topic
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def _rpc(chain: str) -> str:
    settings = get_settings()
    return settings.BASE_RPC_URL if chain == "base" else settings.ARC_RPC_URL


def _usdc(chain: str) -> str:
    return USDC_BASE if chain == "base" else USDC_ARC


class BlockchainService:
    """
    Stateless service — one instance per request is fine.
    All methods are async; uses httpx.AsyncClient internally.
    """

    async def verify_transfer(
        self,
        tx_hash: str,
        *,
        expected_recipient: str,
        expected_amount_usdc: Decimal,
        chain: str = "base",
    ) -> bool:
        """
        Verify that tx_hash is a confirmed USDC Transfer to expected_recipient
        for exactly expected_amount_usdc.
        Returns True on success; False if not yet confirmed or mismatch.
        """
        receipt = await self._get_receipt(tx_hash, chain=chain)
        if receipt is None:
            logger.debug("tx %s not yet mined on %s", tx_hash, chain)
            return False

        if receipt.get("status") != "0x1":
            logger.info("tx %s reverted on %s", tx_hash, chain)
            return False

        return self._parse_transfer_log(
            receipt,
            expected_recipient=expected_recipient.lower(),
            expected_amount=int(expected_amount_usdc * 10**6),
            chain=chain,
        )

    async def get_usdc_balance(self, wallet: str, chain: str = "base") -> Decimal:
        """Returns USDC balance in human-readable units (divide by 1e6)."""
        # balanceOf(address) → bytes4 selector = 0x70a08231
        data = "0x70a08231" + wallet[2:].zfill(64).lower()
        result = await self._eth_call(data, to=_usdc(chain), chain=chain)
        if result is None:
            return Decimal(0)
        raw = int(result, 16)
        return Decimal(raw) / Decimal(10**6)

    #  Internal RPC helpers 

    async def _post(self, payload: dict, chain: str) -> dict | None:
        url = _rpc(chain)
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as exc:
                logger.error("RPC call failed on %s: %s", chain, exc)
                return None

    async def _get_receipt(self, tx_hash: str, chain: str) -> dict | None:
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_getTransactionReceipt",
            "params": [tx_hash],
            "id": 1,
        }
        data = await self._post(payload, chain)
        if data is None:
            return None
        return data.get("result")

    async def _eth_call(self, data: str, to: str, chain: str) -> str | None:
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"],
            "id": 1,
        }
        resp = await self._post(payload, chain)
        if resp is None:
            return None
        return resp.get("result")

    #  Log parsing 

    def _parse_transfer_log(
        self,
        receipt: dict,
        *,
        expected_recipient: str,
        expected_amount: int,
        chain: str,
    ) -> bool:
        usdc_contract = _usdc(chain).lower()
        for log in receipt.get("logs", []):
            if log.get("address", "").lower() != usdc_contract:
                continue
            topics = log.get("topics", [])
            if len(topics) < 3:
                continue
            if topics[0].lower() != TRANSFER_TOPIC:
                continue
            # topics[2] = recipient (padded)
            recipient_from_log = "0x" + topics[2][-40:]
            if recipient_from_log.lower() != expected_recipient.lower():
                continue
            # data = amount (hex)
            amount_from_log = int(log.get("data", "0x0"), 16)
            if amount_from_log == expected_amount:
                return True
        return False

    #  Convenience: poll until confirmed 

    async def wait_for_confirmation(
        self,
        tx_hash: str,
        *,
        expected_recipient: str,
        expected_amount_usdc: Decimal,
        chain: str = "base",
        max_attempts: int = 30,
        poll_interval: float = 3.0,
    ) -> bool:
        for _ in range(max_attempts):
            confirmed = await self.verify_transfer(
                tx_hash,
                expected_recipient=expected_recipient,
                expected_amount_usdc=expected_amount_usdc,
                chain=chain,
            )
            if confirmed:
                return True
            await asyncio.sleep(poll_interval)
        logger.warning("tx %s not confirmed after %d attempts", tx_hash, max_attempts)
        return False