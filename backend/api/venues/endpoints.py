from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum
import random
from collections import defaultdict

router = APIRouter()

# =============================================================================
# 会場配置API (venue_assignments)
# =============================================================================

class VenueAssignmentBase(BaseModel):
    """会場配置の基本データ"""
    tournament_id: int = Field(..., alias="tournamentId")
    venue_id: int = Field(..., alias="venueId")
    team_id: int = Field(..., alias="teamId")
    match_day: int = Field(..., alias="matchDay")
    slot_order: int = Field(1, alias="slotOrder")

    class Config:
        populate_by_name = True


class VenueAssignmentCreate(BaseModel):
    """会場配置作成リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    venue_id: int = Field(..., alias="venueId")
    team_id: int = Field(..., alias="teamId")
    match_day: int = Field(..., alias="matchDay")
    slot_order: int = Field(1, alias="slotOrder")

    class Config:
        populate_by_name = True


class VenueAssignmentUpdate(BaseModel):
    """会場配置更新リクエスト"""
    venue_id: Optional[int] = Field(None, alias="venueId")
    team_id: Optional[int] = Field(None, alias="teamId")
    match_day: Optional[int] = Field(None, alias="matchDay")
    slot_order: Optional[int] = Field(None, alias="slotOrder")

    class Config:
        populate_by_name = True


class VenueAssignmentBulkCreate(BaseModel):
    """会場配置一括登録リクエスト"""
    assignments: List[VenueAssignmentCreate]


class VenueAssignmentResponse(BaseModel):
    """会場配置レスポンス"""
    id: int
    tournament_id: int = Field(..., alias="tournamentId")
    venue_id: int = Field(..., alias="venueId")
    team_id: int = Field(..., alias="teamId")
    match_day: int = Field(..., alias="matchDay")
    slot_order: int = Field(..., alias="slotOrder")

    class Config:
        populate_by_name = True
        from_attributes = True


class AutoGenerateStrategy(str, Enum):
    """自動配置戦略"""
    REGION_DISPERSED = "region_dispersed"  # 地域分散（同じ地域のチームが同じ会場に集中しない）
    BALANCED = "balanced"  # バランス配置
    RANDOM = "random"  # ランダム配置


class AutoGenerateRequest(BaseModel):
    """自動配置リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    match_day: Optional[int] = Field(None, alias="matchDay")  # 指定しない場合は全日程
    strategy: AutoGenerateStrategy = AutoGenerateStrategy.REGION_DISPERSED
    teams_per_venue: int = Field(4, alias="teamsPerVenue")

    class Config:
        populate_by_name = True


# インメモリストレージ（実際の運用ではSupabaseを使用）
venue_assignments_db: Dict[int, Dict[str, Any]] = {}
venue_assignment_counter = 0


@router.get("/api/venue-assignments", summary="会場配置一覧取得")
async def get_venue_assignments(
    tournament_id: int = Query(..., alias="tournamentId"),
    match_day: Optional[int] = Query(None, alias="matchDay")
):
    """
    会場配置一覧を取得

    - tournament_id: 大会ID（必須）
    - match_day: 試合日（オプション、指定しない場合は全日程）
    """
    results = []
    for assignment_id, assignment in venue_assignments_db.items():
        if assignment["tournament_id"] != tournament_id:
            continue
        if match_day is not None and assignment["match_day"] != match_day:
            continue
        results.append({
            "id": assignment_id,
            **assignment
        })

    # venue_id, slot_order でソート
    results.sort(key=lambda x: (x["venue_id"], x["match_day"], x["slot_order"]))

    return {
        "success": True,
        "assignments": results,
        "total": len(results)
    }


@router.post("/api/venue-assignments", summary="会場配置一括登録")
async def create_venue_assignments(request: VenueAssignmentBulkCreate):
    """
    会場配置を一括登録

    既存の配置がある場合は削除してから登録
    """
    global venue_assignment_counter

    created = []
    for assignment in request.assignments:
        venue_assignment_counter += 1
        new_id = venue_assignment_counter

        venue_assignments_db[new_id] = {
            "tournament_id": assignment.tournament_id,
            "venue_id": assignment.venue_id,
            "team_id": assignment.team_id,
            "match_day": assignment.match_day,
            "slot_order": assignment.slot_order
        }

        created.append({
            "id": new_id,
            **venue_assignments_db[new_id]
        })

    return {
        "success": True,
        "created": len(created),
        "assignments": created
    }


@router.put("/api/venue-assignments/{assignment_id}", summary="会場配置更新")
async def update_venue_assignment(assignment_id: int, request: VenueAssignmentUpdate):
    """
    会場配置を更新
    """
    if assignment_id not in venue_assignments_db:
        raise HTTPException(status_code=404, detail="会場配置が見つかりません")

    assignment = venue_assignments_db[assignment_id]

    if request.venue_id is not None:
        assignment["venue_id"] = request.venue_id
    if request.team_id is not None:
        assignment["team_id"] = request.team_id
    if request.match_day is not None:
        assignment["match_day"] = request.match_day
    if request.slot_order is not None:
        assignment["slot_order"] = request.slot_order

    return {
        "success": True,
        "assignment": {
            "id": assignment_id,
            **assignment
        }
    }


@router.delete("/api/venue-assignments/{assignment_id}", summary="会場配置削除")
async def delete_venue_assignment(assignment_id: int):
    """
    会場配置を削除
    """
    if assignment_id not in venue_assignments_db:
        raise HTTPException(status_code=404, detail="会場配置が見つかりません")

    del venue_assignments_db[assignment_id]

    return {
        "success": True,
        "message": "削除しました"
    }


@router.post("/api/venue-assignments/auto-generate", summary="会場配置自動生成")
async def auto_generate_venue_assignments(request: AutoGenerateRequest):
    """
    チームを会場に自動配置

    地域分散ロジック:
    - 同じ地域のチームが同じ会場に集中しないように配置
    - 各会場にteams_per_venue数のチームを配置

    リクエストボディ:
    - tournament_id: 大会ID
    - match_day: 試合日（省略時は全日程生成）
    - strategy: 配置戦略 (region_dispersed, balanced, random)
    - teams_per_venue: 1会場あたりのチーム数（デフォルト: 4）
    """
    global venue_assignment_counter

    # このAPIはフロントエンドからSupabase経由でチーム・会場情報を取得して呼び出す想定
    # 実際のチーム・会場データはリクエストで受け取る形に拡張可能

    # サンプル実装: リクエストにチーム・会場データが含まれている場合の処理
    # 本番環境ではSupabaseクライアントを使って直接取得する

    return {
        "success": True,
        "message": "自動配置はフロントエンドからSupabase経由でチーム・会場情報を含めて呼び出してください",
        "hint": "POST /api/venue-assignments/auto-generate-with-data を使用してください"
    }


class TeamForAssignment(BaseModel):
    """配置用チームデータ"""
    id: int
    name: str
    region: Optional[str] = None
    prefecture: Optional[str] = None


class VenueForAssignment(BaseModel):
    """配置用会場データ"""
    id: int
    name: str
    max_teams: int = Field(4, alias="maxTeams")

    class Config:
        populate_by_name = True


class AutoGenerateWithDataRequest(BaseModel):
    """チーム・会場データを含む自動配置リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    teams: List[TeamForAssignment]
    venues: List[VenueForAssignment]
    match_day: int = Field(1, alias="matchDay")
    strategy: AutoGenerateStrategy = AutoGenerateStrategy.REGION_DISPERSED
    teams_per_venue: int = Field(4, alias="teamsPerVenue")

    class Config:
        populate_by_name = True


@router.post("/api/venue-assignments/auto-generate-with-data", summary="会場配置自動生成（データ込み）")
async def auto_generate_venue_assignments_with_data(request: AutoGenerateWithDataRequest):
    """
    チームを会場に自動配置（チーム・会場データ込み）

    地域分散ロジック:
    - 同じ地域のチームが同じ会場に集中しないように配置
    - 各会場にteams_per_venue数のチームを配置
    """
    global venue_assignment_counter

    teams = request.teams
    venues = request.venues
    strategy = request.strategy
    teams_per_venue = request.teams_per_venue

    if not teams:
        raise HTTPException(status_code=400, detail="チームが指定されていません")
    if not venues:
        raise HTTPException(status_code=400, detail="会場が指定されていません")

    # 既存の配置を削除
    to_delete = [
        aid for aid, a in venue_assignments_db.items()
        if a["tournament_id"] == request.tournament_id and a["match_day"] == request.match_day
    ]
    for aid in to_delete:
        del venue_assignments_db[aid]

    assignments = []

    if strategy == AutoGenerateStrategy.REGION_DISPERSED:
        # 地域分散ロジック
        # 1. チームを地域ごとにグループ化
        region_teams: Dict[str, List[TeamForAssignment]] = defaultdict(list)
        for team in teams:
            region = team.region or team.prefecture or "unknown"
            region_teams[region].append(team)

        # 2. 各地域からラウンドロビン方式でチームを取り出し、会場に配置
        venue_assignments_list: List[List[TeamForAssignment]] = [[] for _ in venues]
        regions = list(region_teams.keys())
        random.shuffle(regions)  # 地域の順番をシャッフル

        # 各地域のチームリストをシャッフル
        for region in regions:
            random.shuffle(region_teams[region])

        # 地域インデックスとチームインデックスを追跡
        region_indices = {region: 0 for region in regions}
        venue_idx = 0
        teams_placed = 0
        total_teams = len(teams)

        while teams_placed < total_teams:
            placed_this_round = False

            for region in regions:
                if region_indices[region] < len(region_teams[region]):
                    # この地域からチームを取り出す
                    team = region_teams[region][region_indices[region]]
                    region_indices[region] += 1

                    # 会場に空きがあれば配置
                    attempts = 0
                    while attempts < len(venues):
                        if len(venue_assignments_list[venue_idx]) < teams_per_venue:
                            # この会場に同じ地域のチームがいないかチェック
                            same_region_exists = any(
                                (t.region or t.prefecture or "unknown") == (team.region or team.prefecture or "unknown")
                                for t in venue_assignments_list[venue_idx]
                            )
                            if not same_region_exists or all(
                                len(va) >= teams_per_venue or
                                any((t.region or t.prefecture or "unknown") == (team.region or team.prefecture or "unknown")
                                    for t in va)
                                for va in venue_assignments_list
                            ):
                                venue_assignments_list[venue_idx].append(team)
                                teams_placed += 1
                                placed_this_round = True
                                break
                        venue_idx = (venue_idx + 1) % len(venues)
                        attempts += 1
                    else:
                        # 全会場を試しても配置できなかった場合は強制配置
                        for vi, va in enumerate(venue_assignments_list):
                            if len(va) < teams_per_venue:
                                va.append(team)
                                teams_placed += 1
                                placed_this_round = True
                                break

                    venue_idx = (venue_idx + 1) % len(venues)

            if not placed_this_round:
                break

        # 配置結果をDBに登録
        for venue_idx, venue in enumerate(venues):
            for slot_order, team in enumerate(venue_assignments_list[venue_idx], 1):
                venue_assignment_counter += 1
                new_id = venue_assignment_counter
                venue_assignments_db[new_id] = {
                    "tournament_id": request.tournament_id,
                    "venue_id": venue.id,
                    "team_id": team.id,
                    "match_day": request.match_day,
                    "slot_order": slot_order
                }
                assignments.append({
                    "id": new_id,
                    "tournament_id": request.tournament_id,
                    "venue_id": venue.id,
                    "venue_name": venue.name,
                    "team_id": team.id,
                    "team_name": team.name,
                    "match_day": request.match_day,
                    "slot_order": slot_order
                })

    elif strategy == AutoGenerateStrategy.BALANCED:
        # バランス配置: 順番に会場に配置
        team_list = list(teams)
        for idx, team in enumerate(team_list):
            venue_idx = idx // teams_per_venue
            if venue_idx >= len(venues):
                venue_idx = venue_idx % len(venues)
            slot_order = (idx % teams_per_venue) + 1

            venue_assignment_counter += 1
            new_id = venue_assignment_counter
            venue_assignments_db[new_id] = {
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "team_id": team.id,
                "match_day": request.match_day,
                "slot_order": slot_order
            }
            assignments.append({
                "id": new_id,
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "venue_name": venues[venue_idx].name,
                "team_id": team.id,
                "team_name": team.name,
                "match_day": request.match_day,
                "slot_order": slot_order
            })

    else:  # RANDOM
        # ランダム配置
        team_list = list(teams)
        random.shuffle(team_list)

        for idx, team in enumerate(team_list):
            venue_idx = idx // teams_per_venue
            if venue_idx >= len(venues):
                venue_idx = venue_idx % len(venues)
            slot_order = (idx % teams_per_venue) + 1

            venue_assignment_counter += 1
            new_id = venue_assignment_counter
            venue_assignments_db[new_id] = {
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "team_id": team.id,
                "match_day": request.match_day,
                "slot_order": slot_order
            }
            assignments.append({
                "id": new_id,
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "venue_name": venues[venue_idx].name,
                "team_id": team.id,
                "team_name": team.name,
                "match_day": request.match_day,
                "slot_order": slot_order
            })

    return {
        "success": True,
        "created": len(assignments),
        "assignments": assignments,
        "strategy": strategy.value
    }
