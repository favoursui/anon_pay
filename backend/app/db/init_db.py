""""
Creates all tables (dev / CI only).
Production should use Alembic migrations.
"""
from app.core.logging import get_logger
from app.db.session import _get_engine
from app.models import Base

logger = get_logger(__name__)


async def init_db() -> None:
    logger.info("Running create_all (dev mode)…")
    async with _get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    logger.info("Database tables ready.")


async def drop_db() -> None:
    """Dangerous — for test teardown only."""
    async with _get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)