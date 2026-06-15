from typing import Optional
from fastapi import APIRouter, Query

from api.schemas import ProfileListResponse, StatsResponse
from db.mongo import list_profiles, get_stats

router = APIRouter()


@router.get("/profiles", response_model=ProfileListResponse)
async def list_profiles_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None, pattern="^(low|medium|high)$"),
):
    result = await list_profiles(page=page, limit=limit, date_from=date_from, date_to=date_to, risk_level=risk_level)
    return result


@router.get("/stats", response_model=StatsResponse)
async def stats_endpoint():
    return await get_stats()
