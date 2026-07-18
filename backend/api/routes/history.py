from typing import Optional
from fastapi import APIRouter, Query, Depends, HTTPException

from api.schemas import ProfileListResponse, StatsResponse
from api.routes.auth import verify_token
from db.mongo import list_profiles, get_stats, delete_profile

router = APIRouter()


@router.get("/profiles", response_model=ProfileListResponse)
async def list_profiles_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None, pattern="^(low|medium|high)$"),
    q: Optional[str] = Query(None),
    _user: str = Depends(verify_token),
):
    result = await list_profiles(
        page=page, limit=limit, date_from=date_from, date_to=date_to, risk_level=risk_level, q=q
    )
    return result


@router.delete("/profile/{request_id}")
async def delete_profile_endpoint(request_id: str, _user: str = Depends(verify_token)):
    deleted = await delete_profile(request_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return {"deleted": True}


@router.get("/stats", response_model=StatsResponse)
async def stats_endpoint(_user: str = Depends(verify_token)):
    return await get_stats()
