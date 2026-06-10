from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.audit.router import router as audit_router
from app.auth.router import router as auth_router
from app.config_store.router import router as config_router
from app.config_store.service import load_cache
from app.core.database import async_session_factory
from app.core.middleware import setup_middleware
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as db:
        await load_cache(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="AW Monitor", version="0.1.0", lifespan=lifespan)
    setup_middleware(app)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(audit_router)
    app.include_router(config_router)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
