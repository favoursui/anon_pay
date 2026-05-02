"""
Privy JWT verification + FastAPI dependency injection.

Flow:
  1. Client sends  Authorization: Bearer <privy-access-token>
  2. We verify the token against Privy's JWKS using the app's
     PRIVY_APP_ID and PRIVY_SECRET_KEY from settings.
  3. On success we return a PrivyUser with the resolved privy_did.
"""
from __future__ import annotations

import httpx
import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
_bearer = HTTPBearer(auto_error=True)

# Privy public JWKS endpoint
_PRIVY_JWKS_URL = "https://auth.privy.io/api/v1/apps/{app_id}/jwks.json"


class PrivyUser:
    """Lightweight principal extracted from a verified Privy JWT."""

    __slots__ = ("privy_did", "wallet_address", "raw_claims")

    def __init__(self, privy_did: str, wallet_address: str | None, raw_claims: dict):
        self.privy_did = privy_did
        self.wallet_address = wallet_address
        self.raw_claims = raw_claims

    def __repr__(self) -> str:
        return f"<PrivyUser did={self.privy_did}>"


# ── JWKS cache (simple in-process, refreshed per process restart) ──────────
_jwks_cache: dict | None = None


async def _fetch_jwks(app_id: str) -> dict:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    url = _PRIVY_JWKS_URL.format(app_id=app_id)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("Privy JWKS fetched and cached for app_id=%s", app_id)
        return _jwks_cache


async def verify_privy_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> PrivyUser:
    """
    FastAPI dependency — attach with  Depends(verify_privy_token).
    Raises HTTP 401 on any verification failure.
    """
    token = credentials.credentials
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode header to pick the correct JWK
        header = pyjwt.get_unverified_header(token)
        kid = header.get("kid")
        logger.debug("Token header: alg=%s kid=%s", header.get("alg"), kid)

        jwks = await _fetch_jwks(settings.PRIVY_APP_ID)
        keys = jwks.get("keys", [])
        signing_key = next((k for k in keys if k.get("kid") == kid), None)

        if signing_key is None:
            logger.warning(
                "No matching JWK for kid=%s — available kids: %s",
                kid, [k.get("kid") for k in keys],
            )
            raise _401

        public_key = pyjwt.algorithms.ECAlgorithm.from_jwk(signing_key)

        # Decode without verification first to log the claims for debugging
        unverified = pyjwt.decode(token, options={"verify_signature": False})
        logger.debug(
            "Token claims (unverified): iss=%s aud=%s sub=%s exp=%s",
            unverified.get("iss"), unverified.get("aud"),
            unverified.get("sub", "")[:20], unverified.get("exp"),
        )
        logger.debug("Expected audience (PRIVY_APP_ID): %s", settings.PRIVY_APP_ID)

        claims = pyjwt.decode(
            token,
            key=public_key,
            algorithms=["ES256"],
            # Privy access tokens have aud="https://auth.privy.io"
            # app-id is in the "aid" claim instead
            audience="https://auth.privy.io",
            options={"verify_exp": True},
        )

        # Verify the token belongs to our app via the "aid" claim
        if claims.get("aid") != settings.PRIVY_APP_ID:
            logger.warning(
                "Token app ID mismatch: got=%s expected=%s",
                claims.get("aid"), settings.PRIVY_APP_ID,
            )
            raise _401

        privy_did: str = claims.get("sub", "")
        wallet: str | None = claims.get("evm_address") or claims.get("wallet_address")
        logger.info("Token verified: privy_did=%s…", privy_did[:20])

        return PrivyUser(privy_did=privy_did, wallet_address=wallet, raw_claims=claims)

    except pyjwt.ExpiredSignatureError:
        logger.warning("Privy token EXPIRED")
        raise _401
    except pyjwt.InvalidAudienceError as exc:
        logger.warning("Privy token audience mismatch: %s — check PRIVY_APP_ID in .env", exc)
        raise _401
    except pyjwt.PyJWTError as exc:
        logger.warning("Privy JWT error (%s): %s", type(exc).__name__, exc)
        raise _401
    except httpx.HTTPError as exc:
        logger.error("Failed to fetch Privy JWKS: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable.",
        )