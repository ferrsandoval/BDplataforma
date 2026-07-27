"""
Dev-only example data. Seeds the profile store with complete expedientes so the
UI can be reviewed without running the full enrichment pipeline (Celery/Redis).

Enabled by setting the env var SEED_EXAMPLES=1 before starting the backend.
Idempotent: uses fixed request_ids, so re-running overwrites rather than duplicates.
"""
from datetime import datetime, timezone, timedelta


def _iso(days_ago: int, hour: int = 10, minute: int = 30) -> str:
    base = datetime.now(timezone.utc).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return (base - timedelta(days=days_ago)).isoformat()


def _sources(ok=True):
    rows = [
        {"source": "LinkedIn", "status": "success", "duration_ms": 245},
        {"source": "Twitter / X", "status": "success", "duration_ms": 187},
        {"source": "News APIs", "status": "success", "duration_ms": 892},
        {"source": "Registros de gobierno", "status": "success", "duration_ms": 1523},
        {"source": "Base de datos interna", "status": "success", "duration_ms": 156},
    ]
    if not ok:
        rows[2]["status"] = "timeout"
        rows[3]["status"] = "error"
    return rows


def _emp(gov=False, entity=None, nss=None, status="desconocido", evidence=None):
    return {
        "is_government_employee": gov,
        "government_entity": entity,
        "nss": nss,
        "employment_status": status,
        "evidence": evidence or [],
    }


EXAMPLES = [
    {
        "request_id": "profile-0001",
        "created_at": _iso(0, 10, 30),
        "status": "complete",
        "processing_duration_ms": 2847,
        "input": {
            "nombre_completo": "Juan Carlos García López",
            "curp": "GARL700101HDFNRN09",
            "rfc": "GARL700101ABC",
            "telefono": "+52 55 1234 5678",
        },
        "ai_summary": (
            "Deudor localizable y con patrimonio identificado. Domicilio confirmado en visita de "
            "campo (Polanco, CDMX) y alta contactabilidad (2 teléfonos activos, 2 referencias "
            "verificadas). Se detecta un inmueble a su nombre sin gravámenes por aprox. $8.2M. Sin "
            "coincidencias en listas negras (OFAC, SAT) ni registros judiciales. Se recomienda "
            "gestión de cobranza con base en el domicilio y contactos confirmados."
        ),
        "employment_info": _emp(
            gov=False,
            status="activo",
            nss="12345678901",
            evidence=["Alta patronal vigente en TechStartup S.A. de C.V."],
        ),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 78, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {
            "social_media": [
                {"platform": "LinkedIn", "url": "https://linkedin.com/in/jcgarcia", "name": "Juan Carlos García", "bio": "Senior Software Engineer · Cloud Infrastructure Lead", "followers": 2345, "public_posts_sample": []},
                {"platform": "Twitter / X", "url": "https://twitter.com/jcgarcia_dev", "name": "@jcgarcia_dev", "bio": "Building scalable systems with React & Node.js", "followers": 1200, "public_posts_sample": []},
                {"platform": "GitHub", "url": "https://github.com/jcgarcia", "name": "jcgarcia", "bio": "Open source · TypeScript, Rust", "followers": 48, "public_posts_sample": []},
            ],
            "news_mentions": [
                {"title": "Tech Company Expands Leadership Team", "source": "Business News Daily", "date": "2026-04-15", "url": "https://businessnewsdaily.com/", "sentiment": "positive"},
                {"title": "Industry Report: Top Engineering Minds", "source": "Tech Industry Magazine", "date": "2026-02-28", "url": "https://techmag.com/", "sentiment": "positive"},
            ],
            "public_records": [
                {"type": "Propiedad inmueble", "source": "Registro Público de Propiedad", "date": "2019-07-22", "description": "Inscripción registral del inmueble ubicado en Polanco, CDMX. Sin gravámenes vigentes.", "url": "https://rpp.gob.mx/"},
                {"type": "Registro de empresa", "source": "Registro Público de Comercio", "date": "2020-03-10", "description": "Co-fundador de TechStartup S.A. de C.V.", "url": "https://rpc.gob.mx/"},
            ],
        },
        "internal_history": {
            "payment_score": 88,
            "loans": [
                {"id": "LOAN-001", "amount": 500000, "date": "2024-06-15", "status": "vigente", "days_overdue": 0},
                {"id": "LOAN-002", "amount": 250000, "date": "2023-01-10", "status": "liquidado", "days_overdue": 0},
                {"id": "LOAN-003", "amount": 120000, "date": "2025-11-02", "status": "vencido", "days_overdue": 45},
            ],
            "references": [
                {"name": "María Rodríguez", "relationship": "Hermana", "phone": "+52 55 5678 1234"},
                {"name": "Pedro Martínez", "relationship": "Socio comercial", "phone": "+52 55 4321 0987"},
            ],
        },
        "sources_queried": _sources(),
    },
    {
        "request_id": "profile-0002",
        "created_at": _iso(0, 9, 15),
        "status": "complete",
        "processing_duration_ms": 2510,
        "input": {"nombre_completo": "María González Sánchez", "curp": "GOSM850305MDFRNN03", "rfc": "GOSM850305XYZ", "telefono": "+52 55 9876 5432"},
        "ai_summary": "Sujeto con presencia pública moderada y buen comportamiento de pago en cartera interna. Contactabilidad media; una referencia verificada. Sin coincidencias en listas negras.",
        "employment_info": _emp(gov=True, entity="Secretaría de Finanzas CDMX", status="activo", nss="98765432109", evidence=["Empleada de gobierno confirmada vía nómina."]),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 40, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {
            "social_media": [
                {"platform": "LinkedIn", "url": "https://linkedin.com/in/mgonzalez", "name": "María González", "bio": "Analista financiera en sector público", "followers": 640, "public_posts_sample": []},
            ],
            "news_mentions": [
                {"title": "Reconocimiento a servidores públicos destacados", "source": "Gaceta CDMX", "date": "2025-12-01", "url": "https://gaceta.cdmx.gob.mx/", "sentiment": "neutral"},
            ],
            "public_records": [
                {"type": "Propiedad inmueble", "source": "Registro Público de Propiedad", "date": "2021-05-18", "description": "Departamento en Del Valle, CDMX. Con hipoteca vigente.", "url": "https://rpp.gob.mx/"},
            ],
        },
        "internal_history": {
            "payment_score": 72,
            "loans": [
                {"id": "LOAN-101", "amount": 300000, "date": "2024-02-20", "status": "vigente", "days_overdue": 0},
            ],
            "references": [
                {"name": "Laura Sánchez", "relationship": "Madre", "phone": "+52 55 1111 2222"},
            ],
        },
        "sources_queried": _sources(),
    },
    {
        "request_id": "profile-0003",
        "created_at": _iso(1, 16, 45),
        "status": "processing",
        "processing_duration_ms": None,
        "input": {"nombre_completo": "Carlos Mendoza Ortiz", "curp": "MEOC800715HDFMNN07", "rfc": "MEOC800715DEF", "telefono": "+52 55 5555 1111"},
        "employment_info": _emp(),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 0, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
        "internal_history": {"payment_score": None, "loans": [], "references": []},
        "sources_queried": [],
    },
    {
        "request_id": "profile-0004",
        "created_at": _iso(2, 9, 20),
        "status": "complete",
        "processing_duration_ms": 3120,
        "input": {"nombre_completo": "Ana Patricia Ruiz Torres", "curp": "RUTA920210MDFZRN05", "rfc": "RUTA920210GH1", "telefono": "+52 55 2233 4455"},
        "ai_summary": "Deudora con alta presencia digital y contactabilidad alta (3 referencias, teléfono activo). Crédito interno vigente al corriente. Sin observaciones de riesgo.",
        "employment_info": _emp(status="activo", nss="11223344556"),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 65, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {
            "social_media": [
                {"platform": "Instagram", "url": "https://instagram.com/anaruiz", "name": "@anaruiz", "bio": "Diseñadora · CDMX", "followers": 5400, "public_posts_sample": []},
                {"platform": "LinkedIn", "url": "https://linkedin.com/in/anaruiz", "name": "Ana Ruiz", "bio": "UX Designer", "followers": 980, "public_posts_sample": []},
            ],
            "news_mentions": [],
            "public_records": [
                {"type": "Registro de empresa", "source": "Registro Público de Comercio", "date": "2022-09-14", "description": "Titular de Estudio Ruiz (persona física con actividad empresarial).", "url": "https://rpc.gob.mx/"},
            ],
        },
        "internal_history": {
            "payment_score": 91,
            "loans": [{"id": "LOAN-201", "amount": 180000, "date": "2025-03-01", "status": "vigente", "days_overdue": 0}],
            "references": [
                {"name": "Jorge Torres", "relationship": "Padre", "phone": "+52 55 3333 4444"},
                {"name": "Sofía Ruiz", "relationship": "Hermana", "phone": "+52 55 5555 6666"},
                {"name": "Carla Méndez", "relationship": "Amiga", "phone": "+52 55 7777 8888"},
            ],
        },
        "sources_queried": _sources(),
    },
    {
        "request_id": "profile-0005",
        "created_at": _iso(2, 18, 5),
        "status": "partial",
        "processing_duration_ms": 4210,
        "input": {"nombre_completo": "Roberto Jiménez Vega", "curp": "JIVR781122HDFMGB02", "rfc": "JIVR781122KL2", "telefono": "+52 81 1122 3344"},
        "ai_summary": "Investigación parcial: algunas fuentes públicas no respondieron. Se detecta crédito vencido en cartera interna con atraso relevante. Contactabilidad baja.",
        "employment_info": _emp(status="inactivo"),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 15, "identity_consistency": True, "overall_risk": "medium"},
        "public_profile": {
            "social_media": [],
            "news_mentions": [
                {"title": "Disputa comercial en tribunal mercantil", "source": "El Norte", "date": "2025-08-11", "url": "https://elnorte.com/", "sentiment": "negative"},
            ],
            "public_records": [],
        },
        "internal_history": {
            "payment_score": 38,
            "loans": [{"id": "LOAN-301", "amount": 420000, "date": "2024-10-05", "status": "vencido", "days_overdue": 120}],
            "references": [],
        },
        "sources_queried": _sources(ok=False),
    },
    {
        "request_id": "profile-0006",
        "created_at": _iso(3, 8, 15),
        "status": "error",
        "processing_duration_ms": None,
        "input": {"nombre_completo": "Diego Salazar Núñez", "curp": "SAND950918HDFLXG01", "rfc": "SAND950918PQ4", "telefono": "+52 55 7788 9900"},
        "employment_info": _emp(),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 0, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {"social_media": [], "news_mentions": [], "public_records": []},
        "internal_history": {"payment_score": None, "loans": [], "references": []},
        "sources_queried": [{"source": "Base de datos interna", "status": "error", "duration_ms": 30}],
    },
    {
        "request_id": "profile-0007",
        "created_at": _iso(4, 12, 40),
        "status": "complete",
        "processing_duration_ms": 2680,
        "input": {"nombre_completo": "Laura Fernández Cruz", "curp": "FECL880630MDFRRR08", "rfc": "FECL880630MN3", "telefono": "+52 33 4455 6677"},
        "ai_summary": "Deudora localizable en Guadalajara. Buen historial de pago (crédito liquidado). Presencia pública baja pero contactabilidad media por referencias internas.",
        "employment_info": _emp(status="activo", nss="66778899001"),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 30, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {
            "social_media": [{"platform": "Facebook", "url": "https://facebook.com/laurafc", "name": "Laura Fernández", "bio": "Guadalajara, Jalisco", "followers": 320, "public_posts_sample": []}],
            "news_mentions": [],
            "public_records": [{"type": "Propiedad inmueble", "source": "Registro Público de Propiedad", "date": "2018-11-30", "description": "Casa habitación en Zapopan, Jalisco.", "url": "https://rpp.gob.mx/"}],
        },
        "internal_history": {
            "payment_score": 80,
            "loans": [{"id": "LOAN-401", "amount": 150000, "date": "2022-04-12", "status": "liquidado", "days_overdue": 0}],
            "references": [{"name": "Miguel Cruz", "relationship": "Esposo", "phone": "+52 33 1234 9876"}],
        },
        "sources_queried": _sources(),
    },
    {
        "request_id": "profile-0008",
        "created_at": _iso(5, 15, 22),
        "status": "complete",
        "processing_duration_ms": 2990,
        "input": {"nombre_completo": "Verónica Aguilar Ríos", "curp": "AIRV830412MDFGSR09", "rfc": "AIRV830412RS5", "telefono": "+52 55 3344 5566"},
        "ai_summary": "Deudora con dos créditos vigentes al corriente y patrimonio inmueble sin gravámenes. Alta contactabilidad. Perfil de bajo riesgo.",
        "employment_info": _emp(status="activo", nss="22334455667"),
        "risk_summary": {"blacklist_hit": False, "judicial_records": False, "digital_presence_score": 55, "identity_consistency": True, "overall_risk": "low"},
        "public_profile": {
            "social_media": [{"platform": "LinkedIn", "url": "https://linkedin.com/in/vaguilar", "name": "Verónica Aguilar", "bio": "Gerente de operaciones", "followers": 1500, "public_posts_sample": []}],
            "news_mentions": [{"title": "Empresa local premia a colaboradores", "source": "Milenio", "date": "2026-01-20", "url": "https://milenio.com/", "sentiment": "positive"}],
            "public_records": [{"type": "Propiedad inmueble", "source": "Registro Público de Propiedad", "date": "2020-06-08", "description": "Departamento en Coyoacán, CDMX. Sin gravámenes.", "url": "https://rpp.gob.mx/"}],
        },
        "internal_history": {
            "payment_score": 84,
            "loans": [
                {"id": "LOAN-501", "amount": 220000, "date": "2024-08-19", "status": "vigente", "days_overdue": 0},
                {"id": "LOAN-502", "amount": 90000, "date": "2025-02-11", "status": "vigente", "days_overdue": 0},
            ],
            "references": [
                {"name": "Ricardo Aguilar", "relationship": "Hermano", "phone": "+52 55 9090 1010"},
                {"name": "Tienda El Sol", "relationship": "Referencia comercial", "phone": "+52 55 2020 3030"},
            ],
        },
        "sources_queried": _sources(),
    },
]


async def seed_examples() -> int:
    """Insert example expedientes into the store. Returns the number seeded."""
    from db.mongo import create_profile, delete_profile

    for doc in EXAMPLES:
        # create_profile inserts unconditionally and request_id has no unique
        # index, so drop any previous copy first to keep re-runs idempotent.
        await delete_profile(doc["request_id"])
        await create_profile(dict(doc))
    return len(EXAMPLES)
