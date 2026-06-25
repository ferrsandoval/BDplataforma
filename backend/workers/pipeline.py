"""
Synchronous enrichment pipeline — runs all workers sequentially in-process.
Used as fallback when Celery/Redis is not available (dev mode).
"""
import time
import asyncio
import logging

from services.normalizer import normalize
from services.scorer import compute_risk
from db.mongo import update_profile

logger = logging.getLogger(__name__)


async def run_pipeline_async(request_id: str, persona_data: dict) -> None:
    await update_profile(request_id, {"status": "processing"})
    start = time.time()

    loop = asyncio.get_event_loop()

    try:
        persona_data = await asyncio.wait_for(
            loop.run_in_executor(None, _prepare_ai_queries, persona_data),
            timeout=15,
        )
    except asyncio.TimeoutError:
        logger.warning("AI query generation timed out")

    async def _timed_worker(kind: str, timeout: int = 30):
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, _call_worker, kind, request_id, persona_data),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("Worker %s timed out after %ds", kind, timeout)
            return {}

    results = await asyncio.gather(
        _timed_worker("social", 30),
        _timed_worker("news", 30),
        _timed_worker("records", 45),
        _timed_worker("blacklist", 20),
        _timed_worker("internal", 10),
        return_exceptions=True,
    )

    worker_results = [r for r in results if isinstance(r, dict)]
    merged = _merge(worker_results)

    try:
        merged = await asyncio.wait_for(
            loop.run_in_executor(None, _ai_enrich, persona_data, merged),
            timeout=30,
        )
    except asyncio.TimeoutError:
        logger.warning("AI enrichment timed out")

    elapsed_ms = int((time.time() - start) * 1000)
    merged["status"] = "complete"
    merged["processing_duration_ms"] = elapsed_ms

    await update_profile(request_id, merged)


def _prepare_ai_queries(persona_data: dict) -> dict:
    """Generate AI-optimized search queries and inject them into persona_data."""
    try:
        from services.ai_analyzer import generate_search_queries
        queries = generate_search_queries(persona_data)
        if queries:
            persona_data = {**persona_data, "ai_queries": queries}
            logger.info("AI queries generated: %s", list(queries.keys()))
    except Exception:
        logger.exception("AI query generation failed, using defaults")
    return persona_data


def _ai_enrich(persona_data: dict, merged: dict) -> dict:
    """AI post-processing: filter relevance, re-score sentiment, extract employment, generate summary."""
    try:
        from services.ai_analyzer import filter_and_analyze, generate_summary, extract_employment_info

        merged = filter_and_analyze(persona_data, merged)

        pp = merged.get("public_profile", {})
        ih = merged.get("internal_history", {})
        risk = merged.get("risk_summary", {})
        new_risk = compute_risk(
            blacklist_hit=risk.get("blacklist_hit", False),
            judicial_records=risk.get("judicial_records", False),
            social_count=len(pp.get("social_media", [])),
            payment_score=ih.get("payment_score"),
            news_sentiments=[n.get("sentiment") for n in pp.get("news_mentions", [])],
            loans=ih.get("loans", []),
        )
        merged["risk_summary"] = new_risk

        employment = extract_employment_info(persona_data, merged)
        if employment:
            merged["employment_info"] = employment

        summary = generate_summary(persona_data, merged)
        if summary:
            merged["ai_summary"] = summary
    except Exception:
        logger.exception("AI enrichment failed, continuing with raw results")
    return merged


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
