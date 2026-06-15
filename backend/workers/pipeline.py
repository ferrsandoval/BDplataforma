"""
Synchronous enrichment pipeline — runs all workers sequentially in-process.
Used as fallback when Celery/Redis is not available (dev mode).
"""
import time
import asyncio

from services.normalizer import normalize
from services.scorer import compute_risk
from db.mongo import update_profile


async def run_pipeline_async(request_id: str, persona_data: dict) -> None:
    await update_profile(request_id, {"status": "processing"})
    start = time.time()

    loop = asyncio.get_event_loop()
    results = await asyncio.gather(
        loop.run_in_executor(None, _call_worker, "social", request_id, persona_data),
        loop.run_in_executor(None, _call_worker, "news", request_id, persona_data),
        loop.run_in_executor(None, _call_worker, "records", request_id, persona_data),
        loop.run_in_executor(None, _call_worker, "blacklist", request_id, persona_data),
        loop.run_in_executor(None, _call_worker, "internal", request_id, persona_data),
        return_exceptions=True,
    )

    elapsed_ms = int((time.time() - start) * 1000)

    worker_results = [r for r in results if isinstance(r, dict)]
    merged = _merge(worker_results)
    merged["status"] = "complete"
    merged["processing_duration_ms"] = elapsed_ms

    await update_profile(request_id, merged)


def _call_worker(kind: str, request_id: str, persona_data: dict) -> dict:
    if kind == "social":
        from workers.social_worker import scrape_social
        return scrape_social(request_id, persona_data)
    elif kind == "news":
        from workers.news_worker import scrape_news
        return scrape_news(request_id, persona_data)
    elif kind == "records":
        from workers.records_worker import scrape_records
        return scrape_records(request_id, persona_data)
    elif kind == "blacklist":
        from workers.blacklist_worker import check_blacklists
        return check_blacklists(request_id, persona_data)
    elif kind == "internal":
        from workers.internal_worker import query_internal
        return query_internal(request_id, persona_data)
    return {}


def _merge(results: list) -> dict:
    merged_social: list = []
    merged_news: list = []
    merged_records: list = []
    merged_loans: list = []
    merged_refs: list = []
    merged_sources: list = []
    payment_score = None
    blacklist_hit = False
    judicial_records = False

    for r in results:
        if not r:
            continue
        merged_sources.extend(r.get("sources_queried", []))
        pp = r.get("public_profile", {})
        merged_social.extend(pp.get("social_media", []))
        merged_news.extend(pp.get("news_mentions", []))
        merged_records.extend(pp.get("public_records", []))
        ih = r.get("internal_history", {})
        merged_loans.extend(ih.get("loans", []))
        merged_refs.extend(ih.get("references", []))
        if ih.get("payment_score") is not None:
            payment_score = ih["payment_score"]
        rs = r.get("risk_summary", {})
        if rs.get("blacklist_hit"):
            blacklist_hit = True
        if rs.get("judicial_records"):
            judicial_records = True

    normalized_news = normalize(merged_news)
    risk = compute_risk(
        blacklist_hit=blacklist_hit,
        judicial_records=judicial_records,
        social_count=len(merged_social),
        payment_score=payment_score,
        news_sentiments=[n.get("sentiment") for n in normalized_news],
        loans=merged_loans,
    )

    return {
        "public_profile": {
            "social_media": merged_social,
            "news_mentions": normalized_news,
            "public_records": merged_records,
        },
        "internal_history": {
            "loans": merged_loans,
            "payment_score": payment_score,
            "references": merged_refs,
        },
        "risk_summary": risk,
        "sources_queried": merged_sources,
    }
