from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.audit.router import router as audit_router
from app.auth.router import router as auth_router
from app.config_store.router import router as config_router
from app.config_store.service import load_cache
from app.core.database import async_session_factory
from app.core.middleware import setup_middleware
from app.ingestion.express_client import start_poller, stop_poller
from app.ingestion.router import router as ingestion_router
from app.monitoring.router import router as monitoring_router
from app.monitoring.scheduler import start_scheduler, stop_scheduler
from app.monitoring.websocket import health_manager
from app.users.router import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as db:
        await load_cache(db)
    start_scheduler()
    start_poller()
    yield
    stop_scheduler()
    stop_poller()


def create_app() -> FastAPI:
    app = FastAPI(title="AW Monitor", version="0.1.0", lifespan=lifespan)
    setup_middleware(app)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(audit_router)
    app.include_router(config_router)
    app.include_router(monitoring_router)
    app.include_router(ingestion_router)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    @app.websocket("/ws/health")
    async def health_ws(websocket: WebSocket):
        await health_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            health_manager.disconnect(websocket)

    return app


app = create_app()
