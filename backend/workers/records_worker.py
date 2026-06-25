"""
Public records worker — searches:
  1. DOF via SIDOF API + DDG (por nombre)
  2. RPP, IMSS, SAT por nombre
  3. DOF, IMSS, SAT por CURP
  4. SAT, DOF por RFC
"""
import time
import httpx
from services.search import web_search
from workers.celery_app import celery

SIDOF_API_URL = "https://sidof.segob.gob.mx/datos_abiertos/busquedaTexto"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-MX,es;q=0.9",
}

NOMBRE_SOURCES = [
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

CURP_SOURCES = [
    {
        "name": "DOF CURP",
        "query": 'site:dof.gob.mx "{curp}"',
        "type": "DOF CURP",
    },
    {
        "name": "IMSS CURP",
        "query": '"{curp}" IMSS México',
        "type": "IMSS CURP",
    },
    {
        "name": "RENAPO CURP",
        "query": '"{curp}" RENAPO México',
        "type": "RENAPO CURP",
    },
]

RFC_SOURCES = [
    {
        "name": "SAT RFC",
        "query": 'site:sat.gob.mx "{rfc}"',
        "type": "SAT RFC",
    },
    {
        "name": "DOF RFC",
        "query": 'site:dof.gob.mx "{rfc}"',
        "type": "DOF RFC",
    },
    {
        "name": "Web RFC",
        "query": '"{rfc}" empresa razón social México',
        "type": "Directorio Fiscal",
    },
]

EMPLEO_NOMBRE_SOURCES = [
    {
        "name": "Servidor Público",
        "query": '"{nombre}" "servidor público" nombramiento gobierno México',
        "type": "Servidor Público",
    },
    {
        "name": "DeclaraNet",
        "query": 'site:declaranet.gob.mx "{nombre}"',
        "type": "Declaración Patrimonial",
    },
    {
        "name": "Nómina Gobierno",
        "query": '"{nombre}" nómina gobierno federal secretaría México',
        "type": "Nómina Gobierno",
    },
]

EMPLEO_CURP_SOURCES = [
    {
        "name": "NSS CURP",
        "query": '"{curp}" NSS "número de seguridad social"',
        "type": "NSS",
    },
    {
        "name": "IMSS Alta",
        "query": '"{curp}" IMSS alta patronal asegurado',
        "type": "IMSS Estatus",
    },
]


def _search(query: str, max_results: int = 3) -> list[dict]:
    return web_search(query, max_results=max_results)


def _try_sidof_api(nombre: str) -> list[dict]:
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
    url = result.get("href", "")
    title = result.get("title", "")
    snippet = result.get("body", "")
    return {
        "type": record_type,
        "source": source_name,
        "date": None,
        "description": f"{title} — {snippet}"[:300],
        "url": url if url.startswith("http") else None,
    }


def _search_sources(source_list: list[dict], fmt: dict, records: list, sources: list, judicial: bool) -> bool:
    for src in source_list:
        query = src["query"].format(**fmt)
        t0 = time.time()
        try:
            results = _search(query, max_results=3)
            elapsed = int((time.time() - t0) * 1000)
            found = False
            for r in results:
                if r.get("href") and r.get("title"):
                    rec = _ddg_to_record(r, src["type"], src["name"])
                    records.append(rec)
                    if "sentencia" in r.get("title", "").lower():
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
        time.sleep(0.5)
    return judicial


@celery.task(
    name="workers.records_worker.scrape_records",
    bind=True,
    max_retries=1,
    soft_time_limit=90,
)
def scrape_records(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    tiene_apellido = bool(
        (persona_data.get("apellido_paterno") or "").strip()
        or (persona_data.get("apellido_materno") or "").strip()
    )
    curp = (persona_data.get("curp") or "").strip()
    rfc = (persona_data.get("rfc") or "").strip()
    sources = []
    records = []
    judicial = False

    tiene_nombre = bool(nombre and tiene_apellido)

    if not tiene_nombre and not curp and not rfc:
        return {
            "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
            "internal_history": {"loans": [], "payment_score": None, "references": []},
            "risk_summary": {"blacklist_hit": False, "judicial_records": False},
            "sources_queried": [],
        }

    fmt = {"nombre": nombre, "curp": curp, "rfc": rfc}

    # ── Búsquedas por nombre ──────────────────────────────────────────────
    if tiene_nombre:
        t0 = time.time()
        sidof_records = _try_sidof_api(nombre)
        elapsed = int((time.time() - t0) * 1000)
        if sidof_records:
            records.extend(sidof_records)
            sources.append({"source": "DOF SIDOF", "status": "success", "duration_ms": elapsed})
        else:
            sources.append({"source": "DOF SIDOF", "status": "not_found", "duration_ms": elapsed})

        judicial = _search_sources(NOMBRE_SOURCES, fmt, records, sources, judicial)

    # ── Búsquedas por CURP ───────────────────────────────────────────────
    if curp:
        judicial = _search_sources(CURP_SOURCES, fmt, records, sources, judicial)

    # ── Búsquedas por RFC ────────────────────────────────────────────────
    if rfc:
        judicial = _search_sources(RFC_SOURCES, fmt, records, sources, judicial)

    # ── Búsquedas de empleo por nombre ─────────────────────────────────
    if tiene_nombre:
        judicial = _search_sources(EMPLEO_NOMBRE_SOURCES, fmt, records, sources, judicial)

    # ── Búsquedas de empleo por CURP ────────────────────────────────────
    if curp:
        judicial = _search_sources(EMPLEO_CURP_SOURCES, fmt, records, sources, judicial)

    # ── Búsquedas adicionales con queries IA ─────────────────────────────
    ai_records = (persona_data.get("ai_queries") or {}).get("records", [])
    for q in ai_records:
        t0 = time.time()
        try:
            results = _search(q, max_results=3)
            elapsed = int((time.time() - t0) * 1000)
            found = False
            for r in results:
                if r.get("href") and r.get("title"):
                    rec = _ddg_to_record(r, "Registro IA", "Búsqueda IA")
                    records.append(rec)
                    if "sentencia" in r.get("title", "").lower():
                        judicial = True
                    found = True
            sources.append({
                "source": "IA Records",
                "status": "success" if found else "not_found",
                "duration_ms": elapsed,
            })
        except Exception:
            elapsed = int((time.time() - t0) * 1000)
            sources.append({"source": "IA Records", "status": "error", "duration_ms": elapsed})
        time.sleep(0.5)

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
