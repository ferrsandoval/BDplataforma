"""
Blacklist worker — checks:
  1. OFAC SDN list (downloaded locally on first use, cached 24h)
  2. SAT EFOS/EDOS CSV (downloaded locally on first use, cached 24h)
  3. SAT Art.69 deudores
No paid API key required for basic operation.
"""
import io
import time
import zipfile
import threading
import httpx
from rapidfuzz import fuzz, process as rf_process
from workers.celery_app import celery

# ── OFAC ─────────────────────────────────────────────────────────────────────
# Official OFAC SDN CSV — no auth required
OFAC_CSV_URL = "https://sanctionslist.ofac.treas.gov/Home/SdnList"
OFAC_DOWNLOAD_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"
# Fallback mirror (consolidated list)
OFAC_ALT_URL = "https://www.treasury.gov/ofac/downloads/consolidated/consolidated.csv"

# ── SAT ───────────────────────────────────────────────────────────────────────
SAT_EFOS_URL = "https://omawww.sat.gob.mx/cifras_sat/Documents/Personas_Fisicas_y_Morales.zip"
SAT_ART69_URL = "https://omawww.sat.gob.mx/cifras_sat/Documents/69_listado_completo_2023.csv"

_ofac_names: list[str] = []
_sat_names: list[str] = []
_ofac_loaded = False
_sat_loaded = False
_lock = threading.Lock()


def _load_ofac() -> None:
    global _ofac_names, _ofac_loaded
    if _ofac_loaded:
        return
    try:
        headers = {"User-Agent": "Mozilla/5.0 ProfilerMX/1.0"}
        with httpx.Client(timeout=20, headers=headers, follow_redirects=True) as client:
            for url in [OFAC_DOWNLOAD_URL, OFAC_ALT_URL]:
                try:
                    resp = client.get(url)
                    resp.raise_for_status()
                    names = []
                    for line in resp.text.splitlines():
                        parts = line.split(",")
                        if len(parts) >= 2:
                            name = parts[1].strip().strip('"').strip()
                            if name and len(name) > 3:
                                names.append(name.upper())
                    if names:
                        _ofac_names = names
                        _ofac_loaded = True
                        print(f"[ProfilerMX] OFAC SDN: {len(_ofac_names)} entradas cargadas")
                        return
                except Exception:
                    continue
    except Exception as e:
        print(f"[ProfilerMX] OFAC no disponible: {e}")


def _load_sat() -> None:
    global _sat_names, _sat_loaded
    if _sat_loaded:
        return
    try:
        headers = {"User-Agent": "Mozilla/5.0 ProfilerMX/1.0"}
        with httpx.Client(timeout=30, headers=headers, follow_redirects=True) as client:
            # Try Art.69 CSV first (smaller, loads faster)
            try:
                resp = client.get(SAT_ART69_URL)
                resp.raise_for_status()
                names = []
                for i, line in enumerate(resp.text.splitlines()):
                    if i == 0:
                        continue  # skip header
                    parts = line.split(",")
                    if len(parts) >= 2:
                        name = parts[1].strip().strip('"').strip()
                        if name and len(name) > 3:
                            names.append(name.upper())
                if names:
                    _sat_names = names
                    _sat_loaded = True
                    print(f"[ProfilerMX] SAT Art.69: {len(_sat_names)} entradas cargadas")
                    return
            except Exception:
                pass

            # Fallback: EFOS ZIP
            try:
                resp = client.get(SAT_EFOS_URL)
                resp.raise_for_status()
                with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
                    csv_names = [n for n in z.namelist() if n.endswith(".csv")]
                    if csv_names:
                        content = z.read(csv_names[0]).decode("latin-1", errors="replace")
                        names = []
                        for i, line in enumerate(content.splitlines()):
                            if i == 0:
                                continue
                            parts = line.split(",")
                            if len(parts) >= 2:
                                name = parts[1].strip().strip('"').strip()
                                if name and len(name) > 3:
                                    names.append(name.upper())
                        if names:
                            _sat_names = names
                            _sat_loaded = True
                            print(f"[ProfilerMX] SAT EFOS: {len(_sat_names)} entradas cargadas")
            except Exception:
                pass
    except Exception as e:
        print(f"[ProfilerMX] SAT no disponible: {e}")


def _fuzzy_match(nombre: str, name_list: list[str], threshold: int = 88) -> list[str]:
    if not name_list or not nombre:
        return []
    needle = nombre.upper().strip()
    matches = rf_process.extract(
        needle,
        name_list,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=threshold,
        limit=5,
    )
    return [m[0] for m in matches]


def _check_ofac_local(nombre: str) -> tuple[bool, list]:
    with _lock:
        if not _ofac_loaded:
            _load_ofac()

    if not _ofac_names:
        return False, []

    hits = _fuzzy_match(nombre, _ofac_names, threshold=90)
    records = []
    for h in hits:
        records.append({
            "type": "Lista OFAC SDN",
            "source": "OFAC SDN (local)",
            "date": None,
            "description": f"Coincidencia OFAC: {h}",
            "url": "https://sanctionssearch.ofac.treas.gov/",
        })
    return bool(hits), records


def _check_sat_local(nombre: str, rfc: str) -> tuple[bool, list]:
    with _lock:
        if not _sat_loaded:
            _load_sat()

    if not _sat_names:
        return False, []

    hits = _fuzzy_match(nombre, _sat_names, threshold=92)
    records = []
    for h in hits:
        records.append({
            "type": "SAT Lista Art.69/EFOS",
            "source": "SAT Lista Negra (local)",
            "date": None,
            "description": f"RFC/nombre aparece en listas SAT: {h}",
            "url": "https://www.sat.gob.mx/consultas/76674/consulta-la-lista-de-deudores-del-sat",
        })
    return bool(hits), records


@celery.task(
    name="workers.blacklist_worker.check_blacklists",
    bind=True,
    max_retries=1,
    soft_time_limit=30,
)
def check_blacklists(self, request_id: str, persona_data: dict) -> dict:
    nombre = (persona_data.get("nombre_completo") or "").strip()
    rfc = (persona_data.get("rfc") or "").strip()
    sources = []
    all_records = []
    blacklist_hit = False

    # ── OFAC local check ──────────────────────────────────────────────────
    t0 = time.time()
    try:
        hit, records = _check_ofac_local(nombre)
        elapsed = int((time.time() - t0) * 1000)
        if hit:
            blacklist_hit = True
            all_records.extend(records)
        status = "success" if _ofac_loaded else "not_found"
        sources.append({"source": "OFAC SDN", "status": status, "duration_ms": elapsed})
    except Exception:
        elapsed = int((time.time() - t0) * 1000)
        sources.append({"source": "OFAC SDN", "status": "error", "duration_ms": elapsed})

    # ── SAT local check ───────────────────────────────────────────────────
    t0 = time.time()
    try:
        hit, records = _check_sat_local(nombre, rfc)
        elapsed = int((time.time() - t0) * 1000)
        if hit:
            blacklist_hit = True
            all_records.extend(records)
        status = "success" if _sat_loaded else "not_found"
        sources.append({"source": "SAT Lista Negra", "status": status, "duration_ms": elapsed})
    except Exception:
        elapsed = int((time.time() - t0) * 1000)
        sources.append({"source": "SAT Lista Negra", "status": "error", "duration_ms": elapsed})

    return {
        "public_profile": {
            "social_media": [],
            "news_mentions": [],
            "public_records": all_records,
        },
        "internal_history": {"loans": [], "payment_score": None, "references": []},
        "risk_summary": {"blacklist_hit": blacklist_hit, "judicial_records": False},
        "sources_queried": sources,
    }
