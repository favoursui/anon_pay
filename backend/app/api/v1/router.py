"""
Aggregates all v1 endpoint routers.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import health, payment_links, payments, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(payments.router)
api_router.include_router(payment_links.router)