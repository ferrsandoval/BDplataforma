"""
Internal worker — queries PostgreSQL for loan history, payment scores, and references.
Skips all queries when PostgreSQL is confirmed unavailable (dev mode).
"""
import time
import asyncio
from workers.celery_app import celery


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery.task(name="workers.internal_worker.query_internal", bind=True, max_retries=1, soft_time_limit=30)
def query_internal(self, request_id: str, persona_data: dict) -> dict:
    from services.health import POSTGRES_OK
    if not POSTGRES_OK:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [
                {"source": "BD Interna — Préstamos", "status": "not_found", "duration_ms": 0},
                {"source": "BD Interna — Score Pago", "status": "not_found", "duration_ms": 0},
                {"source": "BD Interna — Referencias", "status": "not_found", "duration_ms": 0},
            ],
        }

    curp = persona_data.get("curp") or ""
    rfc = persona_data.get("rfc") or ""
    sources = []
    loans = []
    payment_score = None
    references = []

    t0 = time.time()
    try:
        loans = _run(_fetch_loans(curp, rfc))
        sources.append({"source": "BD Interna — Préstamos", "status": "success", "duration_ms": int((time.time() - t0) * 1000)})
    except Exception:
        sources.append({"source": "BD Interna — Préstamos", "status": "error", "duration_ms": int((time.time() - t0) * 1000)})

    t0 = time.time()
    try:
        payment_score = _run(_fetch_score(curp, rfc))
        status = "success" if payment_score is not None else "not_found"
        sources.append({"source": "BD Interna — Score Pago", "status": status, "duration_ms": int((time.time() - t0) * 1000)})
    except Exception:
        sources.append({"source": "BD Interna — Score Pago", "status": "error", "duration_ms": int((time.time() - t0) * 1000)})

    t0 = time.time()
    try:
        references = _run(_fetch_refs(curp, rfc))
        status = "success" if references else "not_found"
        sources.append({"source": "BD Interna — Referencias", "status": status, "duration_ms": int((time.time() - t0) * 1000)})
    except Exception:
        sources.append({"source": "BD Interna — Referencias", "status": "error", "duration_ms": int((time.time() - t0) * 1000)})

    return {
        "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
        "internal_history": {"loans": loans, "payment_score": payment_score, "references": references},
        "risk_summary": {"blacklist_hit": False, "judicial_records": False},
        "sources_queried": sources,
    }


async def _fetch_loans(curp: str, rfc: str) -> list:
    from db.postgres import get_loan_history
    rows = await get_loan_history(curp, rfc)
    return [
        {
            "id": str(r["id"]),
            "amount": float(r["monto"]),
            "date": r["fecha_apertura"].strftime("%d/%m/%Y") if hasattr(r["fecha_apertura"], "strftime") else str(r["fecha_apertura"]),
            "status": r["estatus"],
            "days_overdue": r["dias_vencidos"] or 0,
        }
        for r in rows
    ]


async def _fetch_score(curp: str, rfc: str) -> int | None:
    from db.postgres import get_payment_score
    return await get_payment_score(curp, rfc)


async def _fetch_refs(curp: str, rfc: str) -> list:
    from db.postgres import get_references
    rows = await get_references(curp, rfc)
    return [{"name": r["nombre"], "relationship": r["parentesco"], "phone": r["telefono"]} for r in rows]
