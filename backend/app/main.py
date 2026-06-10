from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.core.middleware import setup_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="AW Monitor", version="0.1.0", lifespan=lifespan)
    setup_middleware(app)
    app.include_router(auth_router)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
