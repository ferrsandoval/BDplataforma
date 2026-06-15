"""
News worker — queries Google News RSS for Mexican news about the subject.
Real implementation using httpx + stdlib XML parser. No API key required.
"""
import time
import httpx
import urllib.parse
from xml.etree import ElementTree as ET
from datetime import datetime
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


def _source_name(url: str) -> str:
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.lower()
        host = host.replace("www.", "")
        known = {
            "eluniversal.com.mx": "El Universal",
            "reforma.com": "Reforma",
            "milenio.com": "Milenio",
            "jornada.com.mx": "La Jornada",
            "expansion.mx": "Expansión",
            "excelsior.com.mx": "Excélsior",
            "proceso.com.mx": "Proceso",
            "informador.mx": "El Informador",
            "heraldo.mx": "El Heraldo",
            "forbes.com.mx": "Forbes México",
        }
        for domain, name in known.items():
            if domain in host:
                return name
        parts = host.split(".")
        return parts[0].capitalize() if parts else host
    except Exception:
        return "Fuente desconocida"


def _fetch_google_news(nombre: str) -> list:
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
        if source_elem is not None and source_elem.text:
            source = source_elem.text.strip()
        else:
            source = _source_name(link)

        if not title:
            continue

        results.append({
            "title": title,
            "source": source,
            "date": _parse_rss_date(pub_date),
            "url": link,
            "sentiment": _classify_sentiment(title),
        })

    return results


@celery.task(
    name="workers.news_worker.scrape_news",
    bind=True,
    max_retries=1,
    soft_time_limit=30,
)
def scrape_news(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    sources = []
    news_results = []

    if not nombre:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [
                {"source": "Google Noticias MX", "status": "not_found", "duration_ms": 0}
            ],
        }

    t0 = time.time()
    try:
        items = _fetch_google_news(nombre)
        elapsed = int((time.time() - t0) * 1000)
        news_results.extend(items)
        status = "success" if items else "not_found"
        sources.append({"source": "Google Noticias MX", "status": status, "duration_ms": elapsed})
    except Exception as exc:
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
