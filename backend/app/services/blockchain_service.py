"""
ARC network - USDC is the NATIVE token.
Transfers are plain value transfers, not ERC-20 contract calls.
Chain config comes from settings — never hardcoded.
"""
from __future__ import annotations

import asyncio
from decimal import Decimal

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class BlockchainService:

    def _rpc_url(self) -> str:
        return get_settings().CHAIN_RPC_URL

    async def verify_transfer(
        self,
        tx_hash: str,
        *,
        expected_recipient: str,
        expected_amount_usdc: Decimal,
        chain: str = "arc",
    ) -> bool:
        """
        Verify a native USDC transfer on ARC.
        Since USDC is native, we check the transaction's `to` and `value` fields
        directly — no ERC-20 log parsing needed.
        """
        tx = await self._get_transaction(tx_hash)
        if tx is None:
            logger.debug("tx %s not found", tx_hash)
            return False

        receipt = await self._get_receipt(tx_hash)
        if receipt is None:
            logger.debug("tx %s receipt not found", tx_hash)
            return False

        if receipt.get("status") != "0x1":
            logger.info("tx %s reverted", tx_hash)
            return False

        # Check recipient
        tx_to = tx.get("to", "").lower()
        if tx_to != expected_recipient.lower():
            logger.warning(
                "Recipient mismatch: got=%s expected=%s",
                tx_to, expected_recipient.lower(),
            )
            return False

        # Check value — USDC has 18 decimals on ARC
        tx_value_hex = tx.get("value", "0x0")
        tx_value = int(tx_value_hex, 16)
        expected_value = int(expected_amount_usdc * Decimal(10**18))

        if tx_value != expected_value:
            logger.warning(
                "Amount mismatch: got=%s expected=%s (raw units)",
                tx_value, expected_value,
            )
            return False

        logger.info("Transfer verified: tx=%s amount=%s USDC", tx_hash[:12], expected_amount_usdc)
        return True

    async def get_native_balance(self, wallet: str) -> Decimal:
        """Returns USDC balance (native) in human-readable units."""
        data = await self._post({
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [wallet, "latest"],
            "id": 1,
        })
        if data is None:
            return Decimal(0)
        raw = int(data.get("result", "0x0"), 16)
        return Decimal(raw) / Decimal(10**18)  # 18 decimals

    async def _post(self, payload: dict) -> dict | None:
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.post(self._rpc_url(), json=payload)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as exc:
                logger.error("RPC call failed: %s", exc)
                return None

    async def _get_transaction(self, tx_hash: str) -> dict | None:
        data = await self._post({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionByHash",
            "params": [tx_hash],
            "id": 1,
        })
        return data.get("result") if data else None

    async def _get_receipt(self, tx_hash: str) -> dict | None:
        data = await self._post({
            "jsonrpc": "2.0",
            "method": "eth_getTransactionReceipt",
            "params": [tx_hash],
            "id": 1,
        })
        return data.get("result") if data else None

    async def wait_for_confirmation(
        self, tx_hash: str, *, expected_recipient: str,
        expected_amount_usdc: Decimal, chain: str = "arc",
        max_attempts: int = 30, poll_interval: float = 3.0,
    ) -> bool:
        for _ in range(max_attempts):
            if await self.verify_transfer(
                tx_hash,
                expected_recipient=expected_recipient,
                expected_amount_usdc=expected_amount_usdc,
                chain=chain,
            ):
                return True
            await asyncio.sleep(poll_interval)
        logger.warning("tx %s not confirmed after %d attempts", tx_hash, max_attempts)
        return False