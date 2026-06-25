"""
Service availability detection at startup.
Sets module-level flags so workers/routes can skip unavailable services instantly.
"""
import asyncio
import socket

MONGO_OK = False
REDIS_OK = False
POSTGRES_OK = False


def _tcp_reachable(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _parse_host_port(url: str, default_port: int) -> tuple[str, int]:
    """Extract host and port from a connection URL."""
    try:
        # strip scheme
        url = url.split("://", 1)[-1]
        # strip path/db
        url = url.split("/")[0]
        # strip credentials
        if "@" in url:
            url = url.split("@")[-1]
        if ":" in url:
            h, p = url.rsplit(":", 1)
            return h, int(p)
        return url, default_port
    except Exception:
        return "localhost", default_port


async def detect_services() -> None:
    global MONGO_OK, REDIS_OK, POSTGRES_OK
    from config import settings

    loop = asyncio.get_event_loop()

    mongo_host, mongo_port = _parse_host_port(settings.mongodb_url, 27017)
    redis_host, redis_port = _parse_host_port(settings.redis_url, 6379)
    pg_host, pg_port = _parse_host_port(settings.postgres_url, 5432)

    MONGO_OK, REDIS_OK, POSTGRES_OK = await asyncio.gather(
        loop.run_in_executor(None, _tcp_reachable, mongo_host, mongo_port, 1.0),
        loop.run_in_executor(None, _tcp_reachable, redis_host, redis_port, 1.0),
        loop.run_in_executor(None, _tcp_reachable, pg_host, pg_port, 1.0),
    )

    status = []
    status.append(f"MongoDB={'OK' if MONGO_OK else 'OFF (memoria)'}")
    status.append(f"Redis={'OK' if REDIS_OK else 'OFF (BackgroundTasks)'}")
    status.append(f"PostgreSQL={'OK' if POSTGRES_OK else 'OFF (omitido)'}")
    print(f"[ProfilerMX] Servicios: {' | '.join(status)}")
