from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.db.init_db import init_db
from app.db.session import wait_for_db

setup_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AnonPay API [env=%s]", settings.ENVIRONMENT)
    await wait_for_db(retries=15, delay=2.0)
    await init_db()  # always run — safe to call on existing tables
    yield
    logger.info("AnonPay API shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=(
            "Privacy-first USDC payment system. "
            "Usernames replace wallet addresses. "
            "Resolution is server-side only."
        ),
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception):
        logger.error("Unhandled exception: %s %s — %s", request.method, request.url, exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred."},
        )

    app.include_router(api_router)
    return app


app = create_app()