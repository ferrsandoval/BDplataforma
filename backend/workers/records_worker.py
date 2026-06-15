"""
Public records worker — searches:
  1. DOF (Diario Oficial de la Federación) via DuckDuckGo site search
  2. SIDOF open data API (direct)
  3. RPP mentions via web search
  4. IMSS/SAT mentions via web search
"""
import time
import httpx
import urllib.parse
from bs4 import BeautifulSoup
from workers.celery_app import celery

DDG_URL = "https://html.duckduckgo.com/html/?q={q}"
SIDOF_SEARCH_URL = "https://sidof.segob.gob.mx/busquedaAvanzada/busqueda"
SIDOF_API_URL = "https://sidof.segob.gob.mx/datos_abiertos/busquedaTexto"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-MX,es;q=0.9",
    "Accept": "text/html,application/xhtml+xml,*/*",
}

RECORD_SOURCES = [
    {
        "name": "DOF",
        "query": 'site:dof.gob.mx "{nombre}"',
        "type": "Diario Oficial de la Federación",
    },
    {
        "name": "RPP CDMX",
        "query": 'site:consejeria.cdmx.gob.mx "{nombre}" registro propiedad',
        "type": "Registro Público de la Propiedad",
    },
    {
        "name": "IMSS Patrón",
        "query": 'site:imss.gob.mx "{nombre}" patrón',
        "type": "IMSS Registro de Patrón",
    },
    {
        "name": "SAT Contribuyente",
        "query": 'site:sat.gob.mx "{nombre}"',
        "type": "SAT Registro Fiscal",
    },
]


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
        url_tag = div.select_one(".result__url")
        if not a:
            continue
        href = a.get("href", "")
        if "uddg=" in href:
            try:
                href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
            except Exception:
                pass
        results.append({
            "title": a.get_text(strip=True),
            "url": href,
            "snippet": snippet.get_text(strip=True) if snippet else "",
            "display_url": url_tag.get_text(strip=True) if url_tag else "",
        })
    return results


def _try_sidof_api(nombre: str) -> list[dict]:
    """Try SIDOF's open data search endpoint."""
    try:
        params = {"palabrasTodas": nombre, "pagina": 1, "cantidad": 10}
        with httpx.Client(timeout=10, headers=HEADERS, follow_redirects=True) as client:
            resp = client.get(SIDOF_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for item in (data.get("listaPublicaciones") or data.get("items") or [])[:5]:
            results.append({
                "type": "DOF Publicación",
                "source": "DOF SIDOF",
                "date": item.get("fecha") or item.get("fechaPublicacion"),
                "description": item.get("titulo") or item.get("resumen") or str(item)[:200],
                "url": item.get("urlPdf") or item.get("url"),
            })
        return results
    except Exception:
        return []


def _ddg_to_record(result: dict, record_type: str, source_name: str) -> dict:
    return {
        "type": record_type,
        "source": source_name,
        "date": None,
        "description": f"{result['title']} — {result['snippet']}"[:300],
        "url": result["url"] if result["url"].startswith("http") else None,
    }


@celery.task(
    name="workers.records_worker.scrape_records",
    bind=True,
    max_retries=1,
    soft_time_limit=30,
)
def scrape_records(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    curp = (persona_data.get("curp") or "").strip()
    rfc = (persona_data.get("rfc") or "").strip()
    sources = []
    records = []
    judicial = False

    if not nombre:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [],
        }

    # ── SIDOF direct API (DOF) ────────────────────────────────────────────
    t0 = time.time()
    sidof_records = _try_sidof_api(nombre)
    elapsed = int((time.time() - t0) * 1000)
    if sidof_records:
        records.extend(sidof_records)
        sources.append({"source": "DOF SIDOF", "status": "success", "duration_ms": elapsed})
    else:
        sources.append({"source": "DOF SIDOF", "status": "not_found", "duration_ms": elapsed})

    # ── DuckDuckGo site searches ─────────────────────────────────────────
    for src in RECORD_SOURCES:
        query = src["query"].format(nombre=nombre, curp=curp, rfc=rfc)
        t0 = time.time()
        try:
            results = _ddg_search(query, max_results=3)
            elapsed = int((time.time() - t0) * 1000)
            found = False
            for r in results:
                if r["url"] and r["title"]:
                    rec = _ddg_to_record(r, src["type"], src["name"])
                    records.append(rec)
                    if "judicial" in src["type"].lower() or "sentencia" in r["title"].lower():
                        judicial = True
                    found = True
            sources.append({
                "source": src["name"],
                "status": "success" if found else "not_found",
                "duration_ms": elapsed,
            })
        except Exception:
            elapsed = int((time.time() - t0) * 1000)
            sources.append({"source": src["name"], "status": "error", "duration_ms": elapsed})

        time.sleep(1)  # rate limit: 1 req/sec per domain

    return {
        "public_profile": {
            "social_media": [],
            "news_mentions": [],
            "public_records": records,
        },
        "internal_history": {"loans": [], "payment_score": None, "references": []},
        "risk_summary": {"blacklist_hit": False, "judicial_records": judicial},
        "sources_queried": sources,
    }
