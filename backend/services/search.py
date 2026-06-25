"""
Unified web search — Google Custom Search API (primary) with DuckDuckGo fallback.
Google CSE free tier: 100 queries/day.  When exhausted or unconfigured, falls back to DDG.
"""
import logging
import httpx
from ddgs import DDGS

logger = logging.getLogger(__name__)

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


def _get_google_keys() -> tuple[str, str]:
    from config import settings
    return settings.google_api_key, settings.google_cx


def web_search(query: str, max_results: int = 5) -> list[dict]:
    """
    Search the web.  Returns list of dicts with keys: title, href, body
    (same shape as DDGS .text() results).
    """
    api_key, cx = _get_google_keys()
    if api_key and cx:
        results = _google_web(query, max_results, api_key, cx)
        if results:
            return results
    return _ddg_web(query, max_results)


def news_search(query: str, max_results: int = 15) -> list[dict]:
    """
    Search news.  Returns list of dicts with keys: title, source, date, url, body.
    """
    api_key, cx = _get_google_keys()
    if api_key and cx:
        results = _google_news(query, min(max_results, 10), api_key, cx)
        if results:
            return results
    return _ddg_news(query, max_results)


# ── Google Custom Search ─────────────────────────────────────────────────────

def _google_web(query: str, max_results: int, api_key: str, cx: str) -> list[dict]:
    try:
        params = {
            "key": api_key,
            "cx": cx,
            "q": query,
            "num": min(max_results, 10),
            "gl": "mx",
            "lr": "lang_es",
        }
        with httpx.Client(timeout=10) as client:
            resp = client.get(GOOGLE_CSE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "title": item.get("title", ""),
                "href": item.get("link", ""),
                "body": item.get("snippet", ""),
            }
            for item in data.get("items", [])
        ]
    except Exception as e:
        logger.warning("Google CSE web error: %s", e)
        return []


def _google_news(query: str, max_results: int, api_key: str, cx: str) -> list[dict]:
    try:
        params = {
            "key": api_key,
            "cx": cx,
            "q": query,
            "num": min(max_results, 10),
            "gl": "mx",
            "lr": "lang_es",
            "sort": "date",
            "dateRestrict": "y1",
        }
        with httpx.Client(timeout=10) as client:
            resp = client.get(GOOGLE_CSE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [
            {
                "title": item.get("title", ""),
                "source": item.get("displayLink", ""),
                "date": (item.get("snippet", "")[:10] if item.get("snippet") else None),
                "url": item.get("link", ""),
                "body": item.get("snippet", ""),
            }
            for item in data.get("items", [])
        ]
    except Exception as e:
        logger.warning("Google CSE news error: %s", e)
        return []


# ── DuckDuckGo fallback ─────────────────────────────────────────────────────

def _ddg_web(query: str, max_results: int = 5) -> list[dict]:
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results, region="mx-es"))
    except Exception as e:
        logger.warning("DDG web error: %s", e)
        return []


def _ddg_news(query: str, max_results: int = 15) -> list[dict]:
    try:
        with DDGS() as ddgs:
            results = []
            for item in ddgs.news(query, region="mx-es", max_results=max_results):
                results.append({
                    "title": item.get("title", "").strip(),
                    "source": item.get("source", "").strip() or "Fuente desconocida",
                    "date": item.get("date", "")[:10] if item.get("date") else None,
                    "url": item.get("url", "").strip() or None,
                    "body": item.get("body", ""),
                })
            return results
    except Exception as e:
        logger.warning("DDG news error: %s", e)
        return []
