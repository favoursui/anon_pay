from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker | None = None


def _build_async_url(url: str) -> str:
    """Ensure the URL uses the asyncpg driver."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if "postgresql://" in url and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        async_url = _build_async_url(settings.DATABASE_URL)
        logger.info("Connecting to database...")
        _engine = create_async_engine(
            async_url,
            echo=not settings.is_production,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=300,
            future=True,
        )
        _session_factory = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
    return _engine


def _get_factory() -> async_sessionmaker:
    _get_engine()
    return _session_factory  # type: ignore[return-value]


async def wait_for_db(retries: int = 15, delay: float = 2.0) -> None:
    """
    Probes DB with a raw asyncpg connection until it's ready.
    Works on Railway, Docker, or any hosted Postgres.
    """
    import asyncpg

    settings = get_settings()

    # Build a plain postgresql:// URL for asyncpg
    raw_url = settings.DATABASE_URL
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
        if raw_url.startswith(prefix):
            raw_url = "postgresql://" + raw_url[len(prefix):]
            break

    import urllib.parse
    try:
        parsed = urllib.parse.urlparse(raw_url)
        logger.info("Waiting for database at host=%r port=%s", parsed.hostname, parsed.port)
    except Exception:
        pass

    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            conn = await asyncpg.connect(raw_url, timeout=5)
            await conn.fetchval("SELECT 1")
            await conn.close()
            logger.info("Database reachable ✓ (attempt %d/%d)", attempt, retries)
            return
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "DB not ready (attempt %d/%d): %s — retrying in %.0fs…",
                attempt, retries, exc, delay,
            )
            await asyncio.sleep(delay)

    raise RuntimeError(
        f"Could not connect to the database after {retries} attempts. "
        f"Last error: {last_exc}. "
        "Check that DATABASE_URL is set correctly in your environment/Railway variables."
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _get_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def db_context() -> AsyncGenerator[AsyncSession, None]:
    async with _get_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise