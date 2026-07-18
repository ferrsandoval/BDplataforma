from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.auth import router as auth_router
from api.routes.enrichment import router as enrichment_router
from api.routes.history import router as history_router
from services.health import detect_services


@asynccontextmanager
async def lifespan(app: FastAPI):
    await detect_services()
    import os
    if os.getenv("SEED_EXAMPLES", "").lower() in ("1", "true", "yes"):
        try:
            from services.seed import seed_examples
            n = await seed_examples()
            print(f"[seed] {n} expedientes de ejemplo cargados")
        except Exception as exc:  # pragma: no cover - dev convenience only
            print(f"[seed] error al sembrar ejemplos: {exc}")
    yield
    try:
        from db.postgres import close_pool
        await close_pool()
    except Exception:
        pass


app = FastAPI(
    title="ProfilerMX API",
    version="1.0.0",
    description="Motor de enriquecimiento de perfiles para evaluación de riesgo crediticio",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(enrichment_router, prefix="/api")
app.include_router(history_router, prefix="/api")


@app.get("/health")
async def health():
    from services.health import MONGO_OK, REDIS_OK, POSTGRES_OK
    return {
        "status": "ok",
        "service": "ProfilerMX",
        "mongodb": MONGO_OK,
        "redis": REDIS_OK,
        "postgresql": POSTGRES_OK,
    }
