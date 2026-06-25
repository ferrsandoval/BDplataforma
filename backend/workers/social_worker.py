"""
Social media worker — finds public social profiles using DuckDuckGo Search (DDGS).
Returns profile links for operator review.
"""
import time
from services.search import web_search
from workers.celery_app import celery

PLATFORM_QUERIES = {
    "LinkedIn": 'site:linkedin.com/in "{nombre}" México',
    "Facebook": 'site:facebook.com "{nombre}" México',
    "Instagram": 'site:instagram.com "{nombre}" México',
    "Twitter/X": 'site:x.com "{nombre}" México',
}


def _search(query: str, max_results: int = 3) -> list[dict]:
    return web_search(query, max_results=max_results)


def _name_matches(search_name: str, result_name: str) -> bool:
    """Verifica que el primer nombre del resultado coincida con el buscado."""
    if not result_name or not search_name:
        return False
    search_parts = search_name.upper().split()
    result_parts = result_name.upper().split()
    if not search_parts or not result_parts:
        return False
    # El primer nombre debe coincidir exactamente
    if search_parts[0] != result_parts[0]:
        return False
    # Todos los apellidos buscados deben estar presentes en el resultado
    for word in search_parts[1:]:
        if word not in result_parts:
            return False
    return True


def _extract_profile(platform: str, search_name: str, result: dict) -> dict | None:
    url = result.get("href", "")
    title = result.get("title", "")
    snippet = result.get("body", "")

    if not url or not any(
        x in url.lower()
        for x in ["linkedin", "facebook", "instagram", "twitter", "x.com"]
    ):
        return None

    extracted_name = title.split(" | ")[0].split(" - ")[0].strip()

    if not _name_matches(search_name, extracted_name):
        return None

    followers = None
    bio = snippet[:200] if snippet else None

    for word in snippet.lower().split():
        clean = word.replace(",", "").replace(".", "")
        if clean.isdigit():
            n = int(clean)
            if 10 < n < 10_000_000:
                followers = n
                break

    return {
        "platform": platform,
        "url": url,
        "name": extracted_name,
        "bio": bio,
        "followers": followers,
        "public_posts_sample": [],
    }


@celery.task(
    name="workers.social_worker.scrape_social",
    bind=True,
    max_retries=1,
    soft_time_limit=60,
)
def scrape_social(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    tiene_apellido = bool(
        (persona_data.get("apellido_paterno") or "").strip()
        or (persona_data.get("apellido_materno") or "").strip()
    )
    sources = []
    social_results = []

    if not nombre or not tiene_apellido:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [],
        }

    ai_social = (persona_data.get("ai_queries") or {}).get("social", {})

    for platform, query_tpl in PLATFORM_QUERIES.items():
        queries = ai_social.get(platform, [query_tpl.format(nombre=nombre)])
        if isinstance(queries, str):
            queries = [queries]

        t0 = time.time()
        found = False
        try:
            for q in queries:
                results = _search(q, max_results=3)
                for r in results:
                    profile = _extract_profile(platform, nombre, r)
                    if profile:
                        social_results.append(profile)
                        found = True
                        break
                if found:
                    break
                time.sleep(0.3)
            elapsed = int((time.time() - t0) * 1000)
            sources.append({
                "source": platform,
                "status": "success" if found else "not_found",
                "duration_ms": elapsed,
            })
        except Exception:
            elapsed = int((time.time() - t0) * 1000)
            sources.append({"source": platform, "status": "error", "duration_ms": elapsed})

        time.sleep(0.3)

    return {
        "public_profile": {
            "social_media": social_results,
            "news_mentions": [],
            "public_records": [],
        },
        "internal_history": {"loans": [], "payment_score": None, "references": []},
        "risk_summary": {"blacklist_hit": False, "judicial_records": False},
        "sources_queried": sources,
    }
