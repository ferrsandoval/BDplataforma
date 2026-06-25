"""
Resolves a person's full name from CURP via RapidAPI CURP-RENAPO (SOAP).
Fallback: DDG web search validated against CURP initials.

Set RAPIDAPI_CURP_KEY in .env to enable the primary resolver.
API: https://rapidapi.com/search/curp-renapo5
"""
import re
from xml.etree import ElementTree as ET
import httpx
from ddgs import DDGS

RENAPO_URL = "https://curp-renapo5.p.rapidapi.com/wsGetIdentidad.asmx"
SOAP_ACTION = "http://tempuri.org/IdentidadPorCURP"

SOAP_BODY = """\
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <IdentidadPorCURP xmlns="http://tempuri.org/">
      <op>IdentidadPorCURP</op>
      <keyAPI>{key_api}</keyAPI>
      <CURP>{curp}</CURP>
    </IdentidadPorCURP>
  </soap:Body>
</soap:Envelope>"""


# ── RapidAPI RENAPO (primario) ────────────────────────────────────────────────

def resolve_from_curp_api(curp: str) -> dict | None:
    from config import settings
    rapidapi_key = settings.rapidapi_curp_key
    key_api = settings.curp_key_api
    if not rapidapi_key or not key_api or not curp or len(curp) != 18:
        return None
    try:
        body = SOAP_BODY.format(curp=curp.upper(), key_api=key_api)
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": SOAP_ACTION,
            "x-rapidapi-host": "curp-renapo5.p.rapidapi.com",
            "x-rapidapi-key": rapidapi_key,
        }
        with httpx.Client(timeout=12, follow_redirects=True) as client:
            r = client.post(RENAPO_URL, content=body.encode("utf-8"), headers=headers)

        if r.status_code == 429:
            print("[ProfilerMX] CURP API: cuota mensual excedida (RapidAPI BASIC)")
            return None
        if r.status_code != 200:
            return None

        # The result is an XML string inside IdentidadPorCURPResult
        root = ET.fromstring(r.content)
        ns = {"soap": "http://schemas.xmlsoap.org/soap/envelope/", "tem": "http://tempuri.org/"}
        result_el = root.find(".//tem:IdentidadPorCURPResult", ns)
        if result_el is None or not result_el.text:
            return None

        result_text = result_el.text.strip()

        if "No tienes acceso" in result_text or "exceeded" in result_text.lower():
            return None

        # Parse the embedded CURPStruct XML
        struct = ET.fromstring(result_text)

        if struct.get("statusOper", "").upper() != "EXITOSO":
            return None

        nombres = (struct.findtext("nombres") or "").strip().title()
        ap = (struct.findtext("apellido1") or "").strip().title()
        am = (struct.findtext("apellido2") or "").strip().title()

        if not nombres and not ap:
            return None

        return {
            "nombre": nombres or None,
            "apellido_paterno": ap or None,
            "apellido_materno": am or None,
        }
    except Exception:
        return None


# ── DDG fallback ──────────────────────────────────────────────────────────────

def _initials_from_curp(curp: str) -> dict:
    curp = curp.upper().strip()
    if len(curp) != 18:
        return {}
    return {
        "ap_paterno": curp[0],
        "ap_materno": curp[2],
        "nombre": curp[3],
    }


def _name_consistent_with_curp(name_dict: dict, initials: dict) -> bool:
    if not initials:
        return True
    ap = (name_dict.get("apellido_paterno") or "").strip().upper()
    am = (name_dict.get("apellido_materno") or "").strip().upper()
    nb = (name_dict.get("nombre") or "").strip().upper()
    if ap and initials.get("ap_paterno") and ap[0] != initials["ap_paterno"]:
        return False
    if am and initials.get("ap_materno") and am[0] != initials["ap_materno"]:
        return False
    if nb and initials.get("nombre") and nb[0] != initials["nombre"]:
        return False
    return True


_NOISE = re.compile(
    r"\b(RFC|CURP|SAT|IMSS|DOF|El|La|Los|Las|Del|De|señor|señora|sr|sra|lic|ing|dr|dra|mtro|mtra)\.?\b",
    flags=re.IGNORECASE,
)
_NAME_WORD = re.compile(r"^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ]{1,}$")


def _try_segment(segment: str) -> dict | None:
    segment = _NOISE.sub("", segment).strip()
    segment = re.sub(r"\b[A-Z0-9]{10,}\b", "", segment).strip()
    words = [w for w in segment.split() if _NAME_WORD.match(w)]
    if len(words) < 2 or len(words) > 5:
        return None
    if len(words) >= 3:
        return {
            "nombre": " ".join(words[:-2]),
            "apellido_paterno": words[-2],
            "apellido_materno": words[-1],
        }
    return {"nombre": None, "apellido_paterno": words[0], "apellido_materno": words[1]}


def _parse_name_from_text(text: str) -> dict | None:
    for seg in re.split(r"[\|\-–—·•,]", text):
        result = _try_segment(seg.strip())
        if result:
            return result
    return None


def _search_and_extract(query: str, initials: dict | None = None) -> dict | None:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=8, region="mx-es"))
        for r in results:
            for field in ("title", "body"):
                candidate = _parse_name_from_text(r.get(field, ""))
                if candidate:
                    if initials is None or _name_consistent_with_curp(candidate, initials):
                        return candidate
    except Exception:
        pass
    return None


# ── Public interface ──────────────────────────────────────────────────────────

def resolve_from_curp(curp: str) -> dict | None:
    """1. RapidAPI RENAPO (real-time, requires key). 2. DDG fallback."""
    result = resolve_from_curp_api(curp)
    if result:
        return result
    initials = _initials_from_curp(curp)
    return _search_and_extract(f'"{curp.upper()}" nombre México', initials)


def resolve_from_rfc(rfc: str) -> dict | None:
    """Searches DDG for the RFC to extract the associated name."""
    if not rfc or len(rfc) < 12:
        return None
    return _search_and_extract(f'"{rfc.upper()}" persona física nombre México SAT')
