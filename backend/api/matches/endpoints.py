from fastapi import APIRouter, Query, Body
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

router = APIRouter()

@router.get("/api/matches", summary="試合一覧取得")
async def get_matches(
    tournament_id: int = Query(..., alias="tournamentId"),
    match_day: Optional[int] = Query(None, alias="matchDay"),
    is_b_match: Optional[bool] = Query(None, alias="isBMatch"),
    group_id: Optional[str] = Query(None, alias="groupId"),
    stage: Optional[str] = Query(None),
    venue_id: Optional[int] = Query(None, alias="venueId"),
    exclude_b_matches: bool = Query(False, alias="excludeBMatches")
):
    """
    試合一覧を取得

    フィルタリングオプション:
    - match_day: 試合日でフィルタ（1, 2, ...）
    - is_b_match: B戦フラグでフィルタ（true/false）
    - group_id: グループIDでフィルタ
    - stage: ステージでフィルタ（preliminary, semifinal, final, training）
    - venue_id: 会場IDでフィルタ
    - exclude_b_matches: B戦を除外（デフォルト: false）

    このエンドポイントはSupabaseから直接取得することを想定しています。
    フロントエンドではSupabaseクライアントを使用してフィルタリングしてください。
    """
    # サンプルレスポンス
    return {
        "success": True,
        "tournament_id": tournament_id,
        "filters": {
            "match_day": match_day,
            "is_b_match": is_b_match,
            "group_id": group_id,
            "stage": stage,
            "venue_id": venue_id,
            "exclude_b_matches": exclude_b_matches
        },
        "matches": [],
        "message": "試合データはSupabaseから直接取得してください。このエンドポイントはフィルタリング仕様の参照用です。"
    }


class MatchFilter(BaseModel):
    """試合フィルタ"""
    tournament_id: int = Field(..., alias="tournamentId")
    match_day: Optional[int] = Field(None, alias="matchDay")
    is_b_match: Optional[bool] = Field(None, alias="isBMatch")
    group_id: Optional[str] = Field(None, alias="groupId")
    stage: Optional[str] = None
    venue_id: Optional[int] = Field(None, alias="venueId")
    exclude_b_matches: bool = Field(False, alias="excludeBMatches")

    class Config:
        populate_by_name = True


@router.post("/api/matches/filter", summary="試合フィルタリング")
async def filter_matches(
    filter_params: MatchFilter,
    matches: List[Dict[str, Any]] = Body(...)
):
    """
    試合リストをフィルタリング

    フロントエンドで取得した試合データをサーバーサイドでフィルタリングする場合に使用。
    通常はSupabaseクエリで直接フィルタリングすることを推奨。
    """
    filtered = matches

    if filter_params.match_day is not None:
        filtered = [m for m in filtered if m.get("match_day") == filter_params.match_day or m.get("matchDay") == filter_params.match_day]

    if filter_params.is_b_match is not None:
        filtered = [m for m in filtered if m.get("is_b_match") == filter_params.is_b_match or m.get("isBMatch") == filter_params.is_b_match]

    if filter_params.exclude_b_matches:
        filtered = [m for m in filtered if not (m.get("is_b_match") or m.get("isBMatch"))]

    if filter_params.group_id is not None:
        filtered = [m for m in filtered if m.get("group_id") == filter_params.group_id or m.get("groupId") == filter_params.group_id]

    if filter_params.stage is not None:
        filtered = [m for m in filtered if m.get("stage") == filter_params.stage]

    if filter_params.venue_id is not None:
        filtered = [m for m in filtered if m.get("venue_id") == filter_params.venue_id or m.get("venueId") == filter_params.venue_id]

    return {
        "success": True,
        "matches": filtered,
        "total": len(filtered),
        "filters_applied": {
            "match_day": filter_params.match_day,
            "is_b_match": filter_params.is_b_match,
            "exclude_b_matches": filter_params.exclude_b_matches,
            "group_id": filter_params.group_id,
            "stage": filter_params.stage,
            "venue_id": filter_params.venue_id
        }
    }
