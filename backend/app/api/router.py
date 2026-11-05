from fastapi import APIRouter

from app.api.routes import auth, data, health, metrics

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(data.router)
api_router.include_router(metrics.router)
