"""
News worker — queries DuckDuckGo News (primary) and Google News RSS (fallback)
for Mexican news about the subject. No API key required.
"""
import time
import httpx
import urllib.parse
from xml.etree import ElementTree as ET
from datetime import datetime
from services.search import news_search
from workers.celery_app import celery

GOOGLE_NEWS_URL = (
    "https://news.google.com/rss/search"
    "?q={q}&hl=es-419&gl=MX&ceid=MX:es-419"
)

NEGATIVE_KW = {
    "fraude", "fraudes", "delito", "delitos", "estafa", "robo", "corrupción",
    "corrupto", "arresto", "arrestado", "detenido", "preso", "imputado",
    "acusado", "demanda", "querella", "multa", "sanción", "lavado",
    "narcotráfico", "homicidio", "asesinato", "violación", "abuso",
    "extorsión", "secuestro", "investigado", "señalado", "condenado",
    "sentenciado", "cárcel", "prisión", "fuga", "embargado", "insolvente",
    "quiebra", "despedido", "escándalo", "soborno", "colusión",
}
POSITIVE_KW = {
    "reconocimiento", "premio", "éxito", "logro", "donación", "filantropía",
    "emprendedor", "innovación", "nombrado", "elegido", "galardonado",
    "benefactor", "inversión", "crecimiento", "expansión", "certificación",
}


def _classify_sentiment(text: str) -> str:
    words = set(text.lower().split())
    neg = len(words & NEGATIVE_KW)
    pos = len(words & POSITIVE_KW)
    if neg > pos:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral"


def _parse_rss_date(raw: str) -> str | None:
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            dt = datetime.strptime(raw.strip(), fmt)
            return dt.strftime("%d/%m/%Y")
        except Exception:
            continue
    return raw[:10] if raw else None


def _fetch_news(query: str, max_results: int = 15) -> list[dict]:
    raw = news_search(query, max_results=max_results)
    results = []
    for item in raw:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        results.append({
            "title": title,
            "source": item.get("source", "Fuente desconocida"),
            "date": item.get("date"),
            "url": item.get("url"),
            "sentiment": _classify_sentiment(title + " " + (item.get("body") or "")),
        })
    return results


def _fetch_google_news(nombre: str) -> list[dict]:
    q = urllib.parse.quote(f'"{nombre}"')
    url = GOOGLE_NEWS_URL.format(q=q)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/rss+xml,application/xml,text/xml,*/*",
        "Accept-Language": "es-MX,es;q=0.9",
    }
    with httpx.Client(timeout=15, headers=headers, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError:
        return []

    results = []
    for item in root.findall(".//item")[:15]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_elem = item.find("source")
        source = (source_elem.text or "").strip() if source_elem is not None else "Google Noticias"

        if not title:
            continue
        results.append({
            "title": title,
            "source": source,
            "date": _parse_rss_date(pub_date),
            "url": link or None,
            "sentiment": _classify_sentiment(title),
        })
    return results


@celery.task(
    name="workers.news_worker.scrape_news",
    bind=True,
    max_retries=1,
    soft_time_limit=45,
)
def scrape_news(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    tiene_apellido = bool(
        (persona_data.get("apellido_paterno") or "").strip()
        or (persona_data.get("apellido_materno") or "").strip()
    )
    curp = (persona_data.get("curp") or "").strip()
    rfc = (persona_data.get("rfc") or "").strip()
    sources = []
    news_results = []

    tiene_nombre = bool(nombre and tiene_apellido)

    if not tiene_nombre and not curp and not rfc:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [
                {"source": "Noticias", "status": "not_found", "duration_ms": 0}
            ],
        }

    # Términos de búsqueda: AI queries si existen, si no el nombre/CURP/RFC
    ai_news = (persona_data.get("ai_queries") or {}).get("news", [])
    default_term = nombre if tiene_nombre else (curp if curp else rfc)
    search_terms = ai_news if ai_news else [default_term]

    # ── DuckDuckGo News (primario) ────────────────────────────────────────
    t0 = time.time()
    try:
        for term in search_terms:
            items = _fetch_news(f'"{term}"')
            news_results.extend(items)
            if items:
                break
            time.sleep(0.3)
        elapsed = int((time.time() - t0) * 1000)
        sources.append({
            "source": "DDG Noticias",
            "status": "success" if news_results else "not_found",
            "duration_ms": elapsed,
        })
    except Exception:
        elapsed = int((time.time() - t0) * 1000)
        sources.append({"source": "DDG Noticias", "status": "error", "duration_ms": elapsed})

        # ── Google News RSS (fallback) ────────────────────────────────────
        t0 = time.time()
        try:
            items = _fetch_google_news(default_term)
            elapsed = int((time.time() - t0) * 1000)
            news_results.extend(items)
            sources.append({
                "source": "Google Noticias MX",
                "status": "success" if items else "not_found",
                "duration_ms": elapsed,
            })
        except Exception:
            elapsed = int((time.time() - t0) * 1000)
            sources.append({"source": "Google Noticias MX", "status": "error", "duration_ms": elapsed})

    return {
        "public_profile": {
            "social_media": [],
            "news_mentions": news_results,
            "public_records": [],
        },
        "internal_history": {"loans": [], "payment_score": None, "references": []},
        "risk_summary": {"blacklist_hit": False, "judicial_records": False},
        "sources_queried": sources,
    }
