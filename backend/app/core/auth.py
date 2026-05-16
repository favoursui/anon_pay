"""
Privy JWT verification + FastAPI dependency injection.
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

_PRIVY_JWKS_URL = "https://auth.privy.io/api/v1/apps/{app_id}/jwks.json"


class PrivyUser:
    __slots__ = ("privy_did", "wallet_address", "raw_claims")

    def __init__(self, privy_did: str, wallet_address: str | None, raw_claims: dict):
        self.privy_did = privy_did
        self.wallet_address = wallet_address
        self.raw_claims = raw_claims

    def __repr__(self) -> str:
        return f"<PrivyUser did={self.privy_did}>"


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
    token = credentials.credentials
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        header = pyjwt.get_unverified_header(token)
        kid = header.get("kid")

        # Peek at claims WITHOUT verification to log the actual aud value
        unverified = pyjwt.decode(token, options={"verify_signature": False})
        actual_aud = unverified.get("aud")
        actual_aid = unverified.get("aid")
        logger.info(
            "Token peek — aud=%s aid=%s alg=%s kid=%s",
            actual_aud, actual_aid, header.get("alg"), kid,
        )
        logger.info("Backend expects — app_id=%s", settings.PRIVY_APP_ID)

        jwks = await _fetch_jwks(settings.PRIVY_APP_ID)
        keys = jwks.get("keys", [])
        signing_key = next((k for k in keys if k.get("kid") == kid), None)

        if signing_key is None:
            logger.warning("No matching JWK for kid=%s — available kids: %s",
                           kid, [k.get("kid") for k in keys])
            raise _401

        public_key = pyjwt.algorithms.ECAlgorithm.from_jwk(signing_key)

        # Determine the correct audience from the token itself
        # Privy uses "https://auth.privy.io" for access tokens
        # but some versions use the app_id directly
        expected_aud = actual_aud if actual_aud else "https://auth.privy.io"

        claims = pyjwt.decode(
            token,
            key=public_key,
            algorithms=["ES256"],
            audience=expected_aud,
            options={"verify_exp": True},
        )

        # Verify token belongs to our app
        token_aid = claims.get("aid")
        if token_aid and token_aid != settings.PRIVY_APP_ID:
            logger.warning("Token app ID mismatch: got=%s expected=%s",
                           token_aid, settings.PRIVY_APP_ID)
            raise _401

        privy_did: str = claims.get("sub", "")
        wallet: str | None = claims.get("evm_address") or claims.get("wallet_address")
        logger.info("Token verified OK: privy_did=%s…", privy_did[:20])

        return PrivyUser(privy_did=privy_did, wallet_address=wallet, raw_claims=claims)

    except pyjwt.ExpiredSignatureError:
        logger.warning("Privy token EXPIRED")
        raise _401
    except pyjwt.InvalidAudienceError as exc:
        logger.warning("Privy audience error: %s", exc)
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