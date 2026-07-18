"""
In-memory profile store — used as fallback when MongoDB is not available.
Stores profiles in a module-level dict. Data is lost on restart.
"""
from typing import Optional
import math

_profiles: dict[str, dict] = {}


def mem_create(doc: dict) -> None:
    _profiles[doc["request_id"]] = doc


def mem_get(request_id: str) -> Optional[dict]:
    return _profiles.get(request_id)


def mem_delete(request_id: str) -> bool:
    return _profiles.pop(request_id, None) is not None


def mem_update(request_id: str, update: dict) -> None:
    if request_id in _profiles:
        _profiles[request_id].update(update)


def mem_list(
    page: int,
    limit: int,
    risk_level: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    q: Optional[str] = None,
) -> dict:
    items = sorted(_profiles.values(), key=lambda x: x.get("created_at", ""), reverse=True)
    if risk_level:
        items = [i for i in items if i.get("risk_summary", {}).get("overall_risk") == risk_level]
    if date_from:
        items = [i for i in items if i.get("created_at", "") >= date_from]
    if date_to:
        items = [i for i in items if i.get("created_at", "") <= date_to + "T23:59:59"]
    if q:
        needle = q.strip().lower()
        def _match(i: dict) -> bool:
            inp = i.get("input", {}) or {}
            haystack = " ".join(
                str(inp.get(f, "")) for f in ("nombre_completo", "curp", "rfc", "telefono")
            ).lower()
            return needle in haystack
        items = [i for i in items if _match(i)]
    total = len(items)
    start = (page - 1) * limit
    return {
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total else 0,
        "items": items[start : start + limit],
    }


def mem_stats() -> dict:
    from datetime import datetime, timezone

    items = list(_profiles.values())
    total = len(items)
    dist = {"low": 0, "medium": 0, "high": 0}
    durations = []
    in_process = 0
    completed_today = 0
    today = datetime.now(timezone.utc).date().isoformat()
    for item in items:
        r = item.get("risk_summary", {}).get("overall_risk", "low")
        if r in dist:
            dist[r] += 1
        d = item.get("processing_duration_ms")
        if d:
            durations.append(d)
        status = item.get("status")
        if status in ("pending", "processing"):
            in_process += 1
        if status == "complete" and str(item.get("created_at", "")).startswith(today):
            completed_today += 1
    avg = sum(durations) / len(durations) if durations else 0
    return {
        "total_searches": total,
        "avg_processing_time_ms": round(avg, 1),
        "risk_distribution": dist,
        "in_process": in_process,
        "completed_today": completed_today,
    }
