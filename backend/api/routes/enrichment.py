import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends

from api.schemas import EnrichmentRequest, EnrichmentResponse
from api.routes.auth import verify_token
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


async def _resolve_name(payload: EnrichmentRequest) -> dict:
    """
    Resolves nombre/apellidos from CURP or RFC when the operator didn't provide them.
    Returns the enriched persona_data dict ready for workers.
    """
    import asyncio
    data = payload.model_dump()

    # Only resolve if no name was provided
    if payload.nombre_completo:
        return data

    resolved = None
    if payload.curp:
        loop = asyncio.get_event_loop()
        from services.name_resolver import resolve_from_curp
        resolved = await loop.run_in_executor(None, resolve_from_curp, payload.curp)

    if not resolved and payload.rfc:
        loop = asyncio.get_event_loop()
        from services.name_resolver import resolve_from_rfc
        resolved = await loop.run_in_executor(None, resolve_from_rfc, payload.rfc)

    if resolved:
        for field in ("nombre", "apellido_paterno", "apellido_materno"):
            if resolved.get(field) and not data.get(field):
                data[field] = resolved[field]
        # Recompute nombre_completo
        parts = [p for p in [data.get("nombre"), data.get("apellido_paterno"), data.get("apellido_materno")] if p]
        data["nombre_completo"] = " ".join(parts) if parts else None

    return data


@router.post("/enrich", response_model=EnrichmentResponse, status_code=202)
async def enrich(payload: EnrichmentRequest, background_tasks: BackgroundTasks, _user: str = Depends(verify_token)):
    curp = payload.curp or ""
    rfc = payload.rfc or ""

    if curp and rfc:
        cached_id = get_cached_request_id(curp, rfc)
        if cached_id:
            existing = await get_profile(cached_id)
            if existing and existing.get("status") == "complete":
                return EnrichmentResponse(request_id=cached_id, status="complete")

    # Resolve name from CURP/RFC if not provided
    persona_data = await _resolve_name(payload)

    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    input_data = payload.model_dump(exclude={"operador_id"})
    # If name was resolved externally, store it in input so it shows in the UI
    for field in ("nombre", "apellido_paterno", "apellido_materno", "nombre_completo"):
        if persona_data.get(field) and not input_data.get(field):
            input_data[field] = persona_data[field]

    doc = {
        "request_id": request_id,
        "created_at": now,
        "status": "pending",
        "processing_duration_ms": None,
        "input": input_data,
        "operador_id": payload.operador_id or "OP-001",
        "employment_info": {
            "is_government_employee": None,
            "government_entity": None,
            "nss": None,
            "employment_status": "desconocido",
            "evidence": [],
        },
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

    if not _try_celery(request_id, persona_data):
        background_tasks.add_task(_run_inline, request_id, persona_data)

    return EnrichmentResponse(request_id=request_id, status="pending")


@router.get("/profile/{request_id}", response_model=dict)
async def get_profile_endpoint(request_id: str, _user: str = Depends(verify_token)):
    doc = await get_profile(request_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return doc


@router.get("/curp/validate/{curp}")
async def validate_curp_endpoint(curp: str, _user: str = Depends(verify_token)):
    from services.curp_validator import validate_curp
    return validate_curp(curp)
