import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks

from api.schemas import EnrichmentRequest, EnrichmentResponse
from db.mongo import create_profile, get_profile
from services.cache import get_cached_request_id, set_cached_request_id

router = APIRouter()


def _try_celery(request_id: str, persona_data: dict) -> bool:
    """Send task to Celery only when Redis is confirmed available."""
    from services.health import REDIS_OK
    if not REDIS_OK:
        return False
    try:
        from workers.celery_app import run_enrichment_pipeline
        run_enrichment_pipeline.delay(request_id, persona_data)
        return True
    except Exception:
        return False


async def _run_inline(request_id: str, persona_data: dict) -> None:
    from workers.pipeline import run_pipeline_async
    await run_pipeline_async(request_id, persona_data)


@router.post("/enrich", response_model=EnrichmentResponse, status_code=202)
async def enrich(payload: EnrichmentRequest, background_tasks: BackgroundTasks):
    curp = payload.curp or ""
    rfc = payload.rfc or ""

    if curp and rfc:
        cached_id = get_cached_request_id(curp, rfc)
        if cached_id:
            existing = await get_profile(cached_id)
            if existing and existing.get("status") == "complete":
                return EnrichmentResponse(request_id=cached_id, status="complete")

    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "request_id": request_id,
        "created_at": now,
        "status": "pending",
        "processing_duration_ms": None,
        "input": payload.model_dump(exclude={"operador_id"}),
        "operador_id": payload.operador_id or "OP-001",
        "risk_summary": {
            "blacklist_hit": False,
            "judicial_records": False,
            "digital_presence_score": 0,
            "identity_consistency": True,
            "overall_risk": "low",
        },
        "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
        "internal_history": {"loans": [], "payment_score": None, "references": []},
        "sources_queried": [],
    }

    await create_profile(doc)

    if curp and rfc:
        set_cached_request_id(curp, rfc, request_id)

    if not _try_celery(request_id, payload.model_dump()):
        background_tasks.add_task(_run_inline, request_id, payload.model_dump())

    return EnrichmentResponse(request_id=request_id, status="pending")


@router.get("/profile/{request_id}", response_model=dict)
async def get_profile_endpoint(request_id: str):
    doc = await get_profile(request_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return doc


@router.get("/curp/validate/{curp}")
async def validate_curp_endpoint(curp: str):
    from services.curp_validator import validate_curp
    return validate_curp(curp)
