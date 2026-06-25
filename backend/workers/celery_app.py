import asyncio
import os
import sys
import time
from celery import Celery, group

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from celery.signals import worker_init
from config import settings

celery = Celery(
    "profilermx",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Fail fast when Redis is not available (dev mode without Docker)
    broker_connection_retry_on_startup=False,
    broker_connection_max_retries=0,
    broker_transport_options={"socket_connect_timeout": 1, "socket_timeout": 1},
)


@worker_init.connect
def on_worker_init(**kwargs):
    from services.health import detect_services
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(detect_services())
    finally:
        loop.close()


def _reset_mongo_client():
    import db.mongo as mongo_mod
    if mongo_mod._client is not None:
        mongo_mod._client.close()
        mongo_mod._client = None


@celery.task(name="workers.celery_app.run_enrichment_pipeline")
def run_enrichment_pipeline(request_id: str, persona_data: dict):
    from db.mongo import update_profile
    from workers.social_worker import scrape_social
    from workers.news_worker import scrape_news
    from workers.records_worker import scrape_records
    from workers.blacklist_worker import check_blacklists
    from workers.internal_worker import query_internal

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(update_profile(request_id, {"status": "processing"}))
        start = time.time()

        jobs = group(
            scrape_social.s(request_id, persona_data),
            scrape_news.s(request_id, persona_data),
            scrape_records.s(request_id, persona_data),
            check_blacklists.s(request_id, persona_data),
            query_internal.s(request_id, persona_data),
        )

        result = jobs.apply()
        worker_results = result.get(timeout=120, disable_sync_subtasks=False)

        elapsed_ms = int((time.time() - start) * 1000)
        merged = _merge_results(worker_results)
        merged = _ai_enrich(persona_data, merged)
        merged["status"] = "complete"
        merged["processing_duration_ms"] = elapsed_ms

        loop.run_until_complete(update_profile(request_id, merged))
    finally:
        loop.close()
        _reset_mongo_client()
    return request_id


def _ai_enrich(persona_data: dict, merged: dict) -> dict:
    import logging
    logger = logging.getLogger(__name__)
    try:
        from services.ai_analyzer import filter_and_analyze, generate_summary, extract_employment_info
        from services.scorer import compute_risk

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


def _merge_results(results: list) -> dict:
    from services.normalizer import normalize
    from services.scorer import compute_risk

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
