"""
AI-powered analysis layer using Claude API (Anthropic).
Filters search results for relevance, analyzes sentiment,
and generates profile summaries.  Gracefully degrades when
the API key is missing or the call fails.
"""
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client = None
MODEL = "claude-haiku-4-5-20251001"


def _get_client():
    global _client
    if _client is not None:
        return _client
    from config import settings
    if not settings.anthropic_api_key:
        return None
    import anthropic
    _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _call(system: str, user_msg: str, max_tokens: int = 1024) -> Optional[str]:
    client = _get_client()
    if not client:
        return None
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        return resp.content[0].text
    except Exception as e:
        logger.warning("Claude API error: %s", e)
        return None


def _extract_json(text: str) -> Optional[dict]:
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start < 0 or end <= start:
            return None
        return json.loads(text[start:end])
    except (json.JSONDecodeError, ValueError):
        return None


CURP_STATES = {
    "AS": "Aguascalientes", "BC": "Baja California", "BS": "Baja California Sur",
    "CC": "Campeche", "CL": "Coahuila", "CM": "Colima", "CS": "Chiapas",
    "CH": "Chihuahua", "DF": "Ciudad de México", "DG": "Durango",
    "GT": "Guanajuato", "GR": "Guerrero", "HG": "Hidalgo", "JC": "Jalisco",
    "MC": "Estado de México", "MN": "Michoacán", "MS": "Morelos", "NT": "Nayarit",
    "NL": "Nuevo León", "OC": "Oaxaca", "PL": "Puebla", "QT": "Querétaro",
    "QR": "Quintana Roo", "SP": "San Luis Potosí", "SL": "Sinaloa", "SR": "Sonora",
    "TC": "Tabasco", "TS": "Tamaulipas", "TL": "Tlaxcala", "VZ": "Veracruz",
    "YN": "Yucatán", "ZS": "Zacatecas", "NE": "Extranjero",
}


def _extract_curp_context(curp: str) -> dict:
    if not curp or len(curp) < 16:
        return {}
    ctx: dict = {}
    try:
        yy = int(curp[4:6])
        year = 1900 + yy if yy > 30 else 2000 + yy
        ctx["birth_year"] = year
    except (ValueError, IndexError):
        pass
    sex = curp[10:11] if len(curp) > 10 else ""
    if sex in ("H", "M"):
        ctx["sex"] = "masculino" if sex == "H" else "femenino"
    state_code = curp[11:13] if len(curp) > 12 else ""
    if state_code in CURP_STATES:
        ctx["state"] = CURP_STATES[state_code]
    return ctx


# ---------------------------------------------------------------------------
# 1. Smart query generation (pre-search)
# ---------------------------------------------------------------------------

def generate_search_queries(person_info: dict) -> Optional[dict]:
    """
    Use AI to generate optimized search queries BEFORE workers run.
    Extracts context from CURP (state, age, sex) to narrow searches.
    Returns dict with keys: social, news, records — or None on failure.
    """
    nombre = person_info.get("nombre_completo", "")
    curp = person_info.get("curp", "")
    rfc = person_info.get("rfc", "")
    telefono = person_info.get("telefono", "")

    if not nombre:
        return None

    curp_ctx = _extract_curp_context(curp) if curp else {}

    context_lines = [f"Nombre completo: {nombre}"]
    if curp:
        context_lines.append(f"CURP: {curp}")
    if rfc:
        context_lines.append(f"RFC: {rfc}")
    if curp_ctx.get("state"):
        context_lines.append(f"Estado de nacimiento: {curp_ctx['state']}")
    if curp_ctx.get("sex"):
        context_lines.append(f"Sexo: {curp_ctx['sex']}")
    if curp_ctx.get("birth_year"):
        context_lines.append(f"Año de nacimiento: {curp_ctx['birth_year']}")
    if telefono:
        context_lines.append(f"Teléfono: {telefono}")

    system = (
        "Eres un investigador OSINT experto en búsqueda de personas en México. "
        "Genera queries de búsqueda web optimizados para DuckDuckGo que maximicen "
        "la probabilidad de encontrar información real sobre la persona. "
        "Responde SOLO con JSON válido, sin texto adicional."
    )
    prompt = (
        f"Genera queries de búsqueda para esta persona:\n"
        + "\n".join(f"  {l}" for l in context_lines)
        + "\n\n"
        "Responde con este JSON exacto:\n"
        '{"social":{"LinkedIn":["q1","q2"],"Facebook":["q1"],"Instagram":["q1"],"Twitter/X":["q1"]},'
        '"news":["q1","q2","q3"],'
        '"records":["q1","q2","q3"]}\n\n'
        "Reglas:\n"
        "- Redes sociales: usa site:linkedin.com/in, site:facebook.com, etc. "
        "Combina nombre con estado/ciudad si se conoce. Genera variantes (con/sin segundo nombre)\n"
        "- Noticias: nombre completo entre comillas, también prueba solo nombre+apellido_paterno. "
        "Si hay estado conocido, agrega el nombre del estado\n"
        "- Registros: busca en site:dof.gob.mx, site:sat.gob.mx, site:imss.gob.mx. "
        "Usa nombre, CURP o RFC según estén disponibles\n"
        "- Máximo 2 queries por red social, 3 para noticias, 3 para registros\n"
        "- Todos los queries deben ser strings listos para buscar en DuckDuckGo"
    )

    text = _call(system, prompt, max_tokens=700)
    if not text:
        return None

    parsed = _extract_json(text)
    if not parsed or "social" not in parsed:
        return None

    return parsed


# ---------------------------------------------------------------------------
# 2. Relevance filtering + sentiment re-analysis
# ---------------------------------------------------------------------------

def filter_and_analyze(person_info: dict, merged: dict) -> dict:
    """
    Sends all raw results to Claude to:
      - discard results that do NOT belong to the target person
      - re-classify news sentiment with real NLP instead of keywords
    Returns a *new* merged dict; falls back to the original on failure.
    """
    pp = merged.get("public_profile", {})
    social = pp.get("social_media", [])
    news = pp.get("news_mentions", [])
    records = pp.get("public_records", [])

    if not social and not news and not records:
        return merged

    nombre = person_info.get("nombre_completo", "")
    curp = person_info.get("curp", "")
    rfc = person_info.get("rfc", "")

    compact = {
        "social": [
            {"i": i, "platform": s.get("platform"), "name": s.get("name"),
             "bio": (s.get("bio") or "")[:80]}
            for i, s in enumerate(social)
        ],
        "news": [
            {"i": i, "title": n.get("title"), "source": n.get("source")}
            for i, n in enumerate(news)
        ],
        "records": [
            {"i": i, "type": r.get("type"),
             "desc": (r.get("description") or "")[:120]}
            for i, r in enumerate(records)
        ],
    }

    system = (
        "Eres un analista de inteligencia que filtra resultados de búsqueda web. "
        "Determina cuáles resultados realmente pertenecen a la persona buscada "
        "(descarta los que son de otra persona o irrelevantes) y clasifica el "
        "sentimiento real de cada noticia conservada. "
        "Responde SOLO con JSON válido, sin texto adicional."
    )
    prompt = (
        f"Persona buscada:\n"
        f"  Nombre: {nombre}\n"
        f"  CURP: {curp}\n"
        f"  RFC: {rfc}\n\n"
        f"Resultados crudos:\n{json.dumps(compact, ensure_ascii=False)}\n\n"
        "Responde con este formato exacto:\n"
        '{"social_keep":[0,2],"news_keep":[0,1],"records_keep":[0],'
        '"news_sentiments":{"0":"negative","1":"neutral"}}\n\n'
        "Reglas:\n"
        "- CONSERVA los resultados a menos que estés SEGURO de que pertenecen a otra persona\n"
        "- En caso de duda, SIEMPRE conserva el resultado\n"
        "- Redes sociales: conserva si el nombre coincide parcialmente (nombre + al menos un apellido)\n"
        "- Registros públicos: conserva si mencionan el nombre, CURP o RFC de la persona\n"
        "- Para sentimiento: positive, neutral o negative basado en el titular"
    )

    text = _call(system, prompt, max_tokens=512)
    if not text:
        return merged

    parsed = _extract_json(text)
    if not parsed:
        return merged

    keep_s = set(parsed.get("social_keep", range(len(social))))
    keep_n = set(parsed.get("news_keep", range(len(news))))
    keep_r = set(parsed.get("records_keep", range(len(records))))
    sentiments = parsed.get("news_sentiments", {})

    filtered_news = []
    for i, n in enumerate(news):
        if i in keep_n:
            s = sentiments.get(str(i))
            if s in ("positive", "neutral", "negative"):
                n = {**n, "sentiment": s}
            filtered_news.append(n)

    filtered_social = [s for i, s in enumerate(social) if i in keep_s]
    filtered_records = [r for i, r in enumerate(records) if i in keep_r]

    # Safety: if AI filtered everything out, keep originals
    if social and not filtered_social:
        filtered_social = social
    if records and not filtered_records:
        filtered_records = records
    if news and not filtered_news:
        filtered_news = news

    result = {**merged}
    result["public_profile"] = {
        "social_media": filtered_social,
        "news_mentions": filtered_news,
        "public_records": filtered_records,
    }
    return result


# ---------------------------------------------------------------------------
# 3. Employment info extraction
# ---------------------------------------------------------------------------

def extract_employment_info(person_info: dict, profile_data: dict) -> dict:
    """
    Analyze all search results to extract employment information:
    - Government employee status
    - NSS (social security number)
    - Employment status (active/inactive)
    """
    pp = profile_data.get("public_profile", {})
    records = pp.get("public_records", [])
    news = pp.get("news_mentions", [])

    if not records and not news:
        return {
            "is_government_employee": None,
            "government_entity": None,
            "nss": None,
            "employment_status": "desconocido",
            "evidence": [],
        }

    nombre = person_info.get("nombre_completo", "")
    curp = person_info.get("curp", "")

    compact_records = [
        {"type": r.get("type"), "source": r.get("source"),
         "desc": (r.get("description") or "")[:200]}
        for r in records
    ]
    compact_news = [
        {"title": n.get("title"), "source": n.get("source")}
        for n in news[:10]
    ]

    system = (
        "Eres un analista de inteligencia mexicano especializado en verificación de empleo. "
        "Analiza los resultados de búsqueda y extrae información laboral de la persona. "
        "Responde SOLO con JSON válido, sin texto adicional."
    )
    prompt = (
        f"Analiza estos resultados de búsqueda sobre {nombre} (CURP: {curp}) "
        f"y extrae información laboral.\n\n"
        f"Registros públicos:\n{json.dumps(compact_records, ensure_ascii=False)}\n\n"
        f"Noticias:\n{json.dumps(compact_news, ensure_ascii=False)}\n\n"
        "Responde con este JSON exacto:\n"
        '{"is_government_employee": true/false/null, '
        '"government_entity": "nombre de la entidad o null", '
        '"nss": "número de 11 dígitos o null", '
        '"employment_status": "activo/inactivo/desconocido", '
        '"evidence": ["razón 1", "razón 2"]}\n\n'
        "Reglas:\n"
        "- is_government_employee: true si aparece en DOF con nombramiento, DeclaraNet, "
        "nómina de gobierno, o como servidor público. false si hay evidencia clara de que "
        "no es empleado de gobierno. null si no hay evidencia suficiente\n"
        "- government_entity: nombre de la secretaría, dependencia o entidad gubernamental. "
        "null si no se identifica\n"
        "- nss: solo si encuentras un número de 11 dígitos que sea claramente un NSS. "
        "null si no se encuentra\n"
        "- employment_status: 'activo' si hay evidencia de empleo actual (alta en IMSS, "
        "cargo vigente), 'inactivo' si hay evidencia de baja, 'desconocido' si no hay datos\n"
        "- evidence: lista de 1-3 frases cortas explicando las conclusiones\n"
        "- NO inventes información. Si no hay datos suficientes, usa null o 'desconocido'"
    )

    text = _call(system, prompt, max_tokens=512)
    if not text:
        return {
            "is_government_employee": None,
            "government_entity": None,
            "nss": None,
            "employment_status": "desconocido",
            "evidence": [],
        }

    parsed = _extract_json(text)
    if not parsed:
        return {
            "is_government_employee": None,
            "government_entity": None,
            "nss": None,
            "employment_status": "desconocido",
            "evidence": [],
        }

    return {
        "is_government_employee": parsed.get("is_government_employee"),
        "government_entity": parsed.get("government_entity"),
        "nss": parsed.get("nss"),
        "employment_status": parsed.get("employment_status", "desconocido"),
        "evidence": parsed.get("evidence", []),
    }


# ---------------------------------------------------------------------------
# 4. Profile summary generation
# ---------------------------------------------------------------------------

def generate_summary(person_info: dict, profile_data: dict) -> Optional[str]:
    """Generate a concise executive summary of the enriched profile."""
    nombre = person_info.get("nombre_completo", "Persona")
    pp = profile_data.get("public_profile", {})
    ih = profile_data.get("internal_history", {})
    risk = profile_data.get("risk_summary", {})

    social = pp.get("social_media", [])
    news = pp.get("news_mentions", [])
    records = pp.get("public_records", [])
    loans = ih.get("loans", [])
    score = ih.get("payment_score")

    parts: list[str] = []

    if social:
        platforms = ", ".join(s.get("platform", "") for s in social)
        parts.append(f"Presencia en redes: {platforms}")
    if news:
        neg = sum(1 for n in news if n.get("sentiment") == "negative")
        pos = sum(1 for n in news if n.get("sentiment") == "positive")
        titles = "; ".join(n.get("title", "")[:60] for n in news[:5])
        parts.append(
            f"{len(news)} menciones en medios ({pos} positivas, {neg} negativas). "
            f"Titulares: {titles}"
        )
    if records:
        types = ", ".join(r.get("type", "") for r in records[:5])
        parts.append(f"Registros públicos: {types}")
    if loans:
        active = sum(1 for l in loans if l.get("status") == "vigente")
        overdue = sum(1 for l in loans if l.get("days_overdue", 0) > 0)
        parts.append(f"{len(loans)} créditos internos ({active} vigentes, {overdue} con atraso)")
    if score is not None:
        parts.append(f"Score de pago interno: {score}/100")

    risk_level = risk.get("overall_risk", "low")
    parts.append(f"Nivel de riesgo calculado: {risk_level}")
    if risk.get("blacklist_hit"):
        parts.append("ALERTA: Coincidencia en lista negra (OFAC / SAT Art. 69)")
    if risk.get("judicial_records"):
        parts.append("ALERTA: Posibles antecedentes judiciales detectados")

    if not parts:
        return None

    system = (
        "Eres un analista de riesgo crediticio en México. "
        "Genera un resumen ejecutivo de 3-4 oraciones basado en los datos proporcionados. "
        "Sé profesional, objetivo y conciso. "
        "Menciona hallazgos relevantes tanto positivos como negativos. "
        "Si la información es escasa, indícalo. "
        "Responde SOLO con el texto del resumen, sin encabezados ni formato."
    )
    prompt = (
        f"Genera un resumen ejecutivo del perfil de {nombre}.\n\n"
        f"Datos recopilados:\n" + "\n".join(f"- {p}" for p in parts)
    )

    return _call(system, prompt, max_tokens=300)
