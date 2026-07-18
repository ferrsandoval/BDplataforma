"""
MongoDB profile storage with in-memory fallback.
Uses service health flag set at startup — never blocks on unavailable MongoDB.
"""
from typing import Optional
import math

from config import settings

_client = None


def _use_memory() -> bool:
    from services.health import MONGO_OK
    return not MONGO_OK


def _get_col():
    global _client
    if _use_memory():
        return None
    try:
        if _client is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            _client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
        return _client[settings.mongodb_db]["profiles"]
    except Exception:
        return None


async def delete_profile(request_id: str) -> bool:
    from services.store import mem_delete
    if _use_memory():
        return mem_delete(request_id)
    col = _get_col()
    try:
        result = await col.delete_one({"request_id": request_id})
        return result.deleted_count > 0
    except Exception:
        return mem_delete(request_id)


async def create_profile(doc: dict) -> str:
    from services.store import mem_create
    if _use_memory():
        mem_create(doc)
        return doc["request_id"]
    col = _get_col()
    try:
        await col.insert_one(dict(doc))
    except Exception:
        mem_create(doc)
    return doc["request_id"]


async def get_profile(request_id: str) -> Optional[dict]:
    from services.store import mem_get
    if _use_memory():
        return mem_get(request_id)
    col = _get_col()
    try:
        doc = await col.find_one({"request_id": request_id})
        if doc:
            doc.pop("_id", None)
        return doc
    except Exception:
        return mem_get(request_id)


async def update_profile(request_id: str, update: dict) -> None:
    from services.store import mem_update
    if _use_memory():
        mem_update(request_id, update)
        return
    col = _get_col()
    try:
        await col.update_one({"request_id": request_id}, {"$set": update})
    except Exception:
        mem_update(request_id, update)


async def list_profiles(
    page: int = 1,
    limit: int = 20,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    risk_level: Optional[str] = None,
    q: Optional[str] = None,
) -> dict:
    from services.store import mem_list
    if _use_memory():
        return mem_list(page, limit, risk_level, date_from, date_to, q)
    col = _get_col()
    try:
        import re
        from pymongo import DESCENDING
        query: dict = {}
        if date_from or date_to:
            df: dict = {}
            if date_from:
                df["$gte"] = date_from
            if date_to:
                df["$lte"] = date_to
            query["created_at"] = df
        if risk_level:
            query["risk_summary.overall_risk"] = risk_level
        if q and q.strip():
            rx = re.compile(re.escape(q.strip()), re.IGNORECASE)
            query["$or"] = [
                {"input.nombre_completo": rx},
                {"input.curp": rx},
                {"input.rfc": rx},
                {"input.telefono": rx},
            ]
        total = await col.count_documents(query)
        skip = (page - 1) * limit
        cursor = col.find(query, {"_id": 0}).sort("created_at", DESCENDING).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return {
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if total else 0,
            "items": docs,
        }
    except Exception:
        return mem_list(page, limit, risk_level, date_from, date_to, q)


async def get_stats() -> dict:
    from services.store import mem_stats
    if _use_memory():
        return mem_stats()
    col = _get_col()
    try:
        from datetime import datetime, timezone

        today = datetime.now(timezone.utc).date().isoformat()
        pipeline = [
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "avg_ms": {"$avg": "$processing_duration_ms"},
                "low": {"$sum": {"$cond": [{"$eq": ["$risk_summary.overall_risk", "low"]}, 1, 0]}},
                "medium": {"$sum": {"$cond": [{"$eq": ["$risk_summary.overall_risk", "medium"]}, 1, 0]}},
                "high": {"$sum": {"$cond": [{"$eq": ["$risk_summary.overall_risk", "high"]}, 1, 0]}},
                "in_process": {"$sum": {"$cond": [{"$in": ["$status", ["pending", "processing"]]}, 1, 0]}},
                "completed_today": {"$sum": {"$cond": [
                    {"$and": [
                        {"$eq": ["$status", "complete"]},
                        {"$gte": ["$created_at", today]},
                    ]},
                    1, 0,
                ]}},
            }}
        ]
        result = await col.aggregate(pipeline).to_list(length=1)
        if not result:
            return {
                "total_searches": 0,
                "avg_processing_time_ms": 0,
                "risk_distribution": {"low": 0, "medium": 0, "high": 0},
                "in_process": 0,
                "completed_today": 0,
            }
        row = result[0]
        return {
            "total_searches": row.get("total", 0),
            "avg_processing_time_ms": round(row.get("avg_ms") or 0, 1),
            "risk_distribution": {"low": row.get("low", 0), "medium": row.get("medium", 0), "high": row.get("high", 0)},
            "in_process": row.get("in_process", 0),
            "completed_today": row.get("completed_today", 0),
        }
    except Exception:
        return mem_stats()
