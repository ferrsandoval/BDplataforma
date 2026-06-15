import asyncpg
from typing import Optional
from config import settings

_pool: Optional[asyncpg.Pool] = None
_unavailable = False


async def get_pool() -> asyncpg.Pool:
    global _pool, _unavailable
    if _unavailable:
        raise RuntimeError("PostgreSQL no disponible")
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(
                settings.postgres_url,
                min_size=1,
                max_size=5,
                timeout=3,           # connection timeout in seconds
                command_timeout=5,
            )
        except Exception:
            _unavailable = True
            raise
    return _pool


async def close_pool() -> None:
    global _pool, _unavailable
    if _pool:
        await _pool.close()
        _pool = None
    _unavailable = False


async def get_loan_history(curp: str, rfc: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, monto, fecha_apertura, fecha_cierre, estatus,
               dias_vencidos, tipo_credito
        FROM prestamos
        WHERE curp = $1 OR rfc = $2
        ORDER BY fecha_apertura DESC
        """,
        curp or "",
        rfc or "",
    )
    return [dict(r) for r in rows]


async def get_payment_score(curp: str, rfc: str) -> Optional[int]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT score_pago
        FROM scores_pago
        WHERE curp = $1 OR rfc = $2
        ORDER BY calculado_en DESC
        LIMIT 1
        """,
        curp or "",
        rfc or "",
    )
    return row["score_pago"] if row else None


async def get_references(curp: str, rfc: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT nombre, parentesco, telefono
        FROM referencias
        WHERE curp_solicitante = $1 OR rfc_solicitante = $2
        """,
        curp or "",
        rfc or "",
    )
    return [dict(r) for r in rows]
