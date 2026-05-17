"""
Async SQLAlchemy engine + session factory.
DATABASE_URL is read from settings (never hardcoded).

Engine is created lazily at first use so that import-time module loading
never attempts a DB connection (fixes Docker startup race with Postgres).
"""
from __future__ import annotations

import asyncio
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

# Engine is built once, on first call to _get_engine() 
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker | None = None


def _get_engine() -> AsyncEngine:
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.async_database_url,
            echo=not settings.is_production,
            # AsyncAdaptedQueuePool keeps a small pool of warm connections
            # (much better than NullPool for a persistent server process).
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,      # detects stale connections automatically
            pool_recycle=300,        # recycle every 5 min
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
    _get_engine()   # ensure both are initialised
    return _session_factory  # type: ignore[return-value]





# Retry helper: wait for Postgres to be ready 
async def wait_for_db(
    retries: int = 15,
    delay: float = 2.0,
) -> None:
    """
    Probes the DB with a raw asyncpg connection (bypasses SQLAlchemy pool)
    so we can catch ConnectionRefusedError / OSError directly before
    SQLAlchemy's pool machinery has a chance to crash the process.
    Called once from the FastAPI lifespan handler.
    """
    import asyncpg
    from app.core.config import get_settings

    settings = get_settings()

    # Parse the plain postgresql:// URL for asyncpg (strip +asyncpg driver tag)
    raw_url = settings.DATABASE_URL
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://"):
        if raw_url.startswith(prefix):
            raw_url = "postgresql://" + raw_url[len(prefix):]
            break

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
            if attempt == 1:
                # Extract host from URL for a clear diagnostic on first failure
                try:
                    import urllib.parse
                    parsed = urllib.parse.urlparse(raw_url)
                    logger.error(
                        "Cannot reach database at host=%r port=%s — "
                        "if using Docker Compose, DATABASE_URL host must be the "
                        "service name (e.g. 'db'), not 'localhost'.",
                        parsed.hostname, parsed.port,
                    )
                except Exception:
                    pass
            logger.warning(
                "DB not ready (attempt %d/%d): %s — retrying in %.0fs…",
                attempt, retries, exc, delay,
            )
            await asyncio.sleep(delay)

    raise RuntimeError(
        f"Could not connect to the database after {retries} attempts. "
        f"Last error: {last_exc}. "
        "Check DATABASE_URL and that Postgres is running."
    )


#  FastAPI dependency 
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yields an async DB session; commits on success, rolls back on error."""
    async with _get_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


#  Script / test context manager 
@asynccontextmanager
async def db_context() -> AsyncGenerator[AsyncSession, None]:
    """Async context manager for use outside FastAPI (scripts, tests)."""
    async with _get_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise