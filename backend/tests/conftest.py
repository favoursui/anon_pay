"""
tests/conftest.py

Shared pytest fixtures.
Uses an in-memory SQLite for speed — swap to a real Postgres if needed.
"""
import asyncio
import os
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

#  Force test env vars before app import 
os.environ.setdefault("PRIVY_APP_ID", "test_app_id")
os.environ.setdefault("PRIVY_SECRET_KEY", "test_secret")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("BASE_RPC_URL", "https://mainnet.base.org")
os.environ.setdefault("ARC_RPC_URL", "https://mainnet.arc.io")
os.environ.setdefault("ENCRYPTION_KEY", "Tz3hKsjl3eaTVFqFmrS8rMD7gxZJlFdTr0XqQW7gY0M=")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from app.db.session import get_db
from app.main import app
from app.models import Base


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()