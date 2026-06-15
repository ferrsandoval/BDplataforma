"""
Redis cache layer. Prevents re-scraping the same CURP+RFC within 24 hours.
Cache key: profilermx:cache:{curp}:{rfc}
Value: the request_id of the original enrichment.
"""
import redis
from config import settings

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def _cache_key(curp: str, rfc: str) -> str:
    return f"profilermx:cache:{curp.upper()}:{rfc.upper()}"


def get_cached_request_id(curp: str, rfc: str) -> str | None:
    try:
        return get_redis().get(_cache_key(curp, rfc))
    except Exception:
        return None


def set_cached_request_id(curp: str, rfc: str, request_id: str) -> None:
    try:
        get_redis().setex(_cache_key(curp, rfc), settings.cache_ttl_seconds, request_id)
    except Exception:
        pass


def invalidate_cache(curp: str, rfc: str) -> None:
    try:
        get_redis().delete(_cache_key(curp, rfc))
    except Exception:
        pass
