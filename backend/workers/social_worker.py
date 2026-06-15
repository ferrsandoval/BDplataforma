"""
Social media worker — finds public social profiles using DuckDuckGo HTML search.
No Playwright required. Returns profile links for operator review.
"""
import time
import httpx
import urllib.parse
from bs4 import BeautifulSoup
from workers.celery_app import celery

DDG_URL = "https://html.duckduckgo.com/html/?q={q}"

PLATFORM_QUERIES = {
    "LinkedIn": 'site:linkedin.com/in "{nombre}"',
    "Facebook": 'site:facebook.com "{nombre}" México',
    "Instagram": 'site:instagram.com "{nombre}"',
    "Twitter/X": 'site:x.com OR site:twitter.com "{nombre}" México',
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-MX,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}


def _ddg_search(query: str, max_results: int = 5) -> list[dict]:
    q = urllib.parse.quote_plus(query)
    url = DDG_URL.format(q=q)
    with httpx.Client(timeout=12, headers=HEADERS, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for div in soup.select(".result__body, .web-result")[:max_results]:
        a = div.select_one("a.result__a, h2 a")
        snippet = div.select_one(".result__snippet, .result__description")
        if not a:
            continue
        href = a.get("href", "")
        # DuckDuckGo wraps links — try to extract actual URL
        if "uddg=" in href:
            try:
                href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
            except Exception:
                pass
        results.append({
            "title": a.get_text(strip=True),
            "url": href,
            "snippet": snippet.get_text(strip=True) if snippet else "",
        })
    return results


def _extract_profile(platform: str, result: dict) -> dict | None:
    url = result.get("url", "")
    title = result.get("title", "")
    snippet = result.get("snippet", "")

    if not url or not any(
        x in url.lower()
        for x in ["linkedin", "facebook", "instagram", "twitter", "x.com"]
    ):
        return None

    followers = None
    bio = snippet[:200] if snippet else None

    # Try to extract follower count from snippet
    for word in snippet.lower().split():
        if word.replace(",", "").replace(".", "").isdigit():
            n = int(word.replace(",", "").replace(".", ""))
            if 10 < n < 10_000_000:
                followers = n
                break

    return {
        "platform": platform,
        "url": url,
        "name": title.split(" | ")[0].split(" - ")[0].strip(),
        "bio": bio,
        "followers": followers,
        "public_posts_sample": [],
    }


@celery.task(
    name="workers.social_worker.scrape_social",
    bind=True,
    max_retries=1,
    soft_time_limit=30,
)
def scrape_social(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    sources = []
    social_results = []

    if not nombre:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [],
        }

    for platform, query_tpl in PLATFORM_QUERIES.items():
        query = query_tpl.format(nombre=nombre)
        t0 = time.time()
        try:
            results = _ddg_search(query, max_results=3)
            elapsed = int((time.time() - t0) * 1000)
            found = False
            for r in results:
                profile = _extract_profile(platform, r)
                if profile:
                    social_results.append(profile)
                    found = True
                    break
            sources.append({
                "source": platform,
                "status": "success" if found else "not_found",
                "duration_ms": elapsed,
            })
        except Exception:
            elapsed = int((time.time() - t0) * 1000)
            sources.append({"source": platform, "status": "error", "duration_ms": elapsed})

        # Respect rate limiting — 1 req/sec
        time.sleep(1)

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
