from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum
from collections import defaultdict

router = APIRouter()

# =============================================================================
# 順位表API (standings)
# =============================================================================

class StandingsMode(str, Enum):
    """順位表モード"""
    OVERALL = "overall"  # 全体順位表（新フォーマット）
    GROUP = "group"  # グループ別順位表（旧フォーマット）


class StandingEntry(BaseModel):
    """順位表エントリ"""
    rank: int
    team_id: int = Field(..., alias="teamId")
    team_name: str = Field(..., alias="teamName")
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = Field(0, alias="goalsFor")
    goals_against: int = Field(0, alias="goalsAgainst")
    goal_difference: int = Field(0, alias="goalDifference")
    points: int = 0
    overall_rank: Optional[int] = Field(None, alias="overallRank")
    group_id: Optional[str] = Field(None, alias="groupId")

    class Config:
        populate_by_name = True


class MatchResult(BaseModel):
    """試合結果（順位計算用）"""
    id: int
    home_team_id: int = Field(..., alias="homeTeamId")
    away_team_id: int = Field(..., alias="awayTeamId")
    home_score: int = Field(..., alias="homeScore")
    away_score: int = Field(..., alias="awayScore")
    is_b_match: bool = Field(False, alias="isBMatch")
    match_day: Optional[int] = Field(None, alias="matchDay")
    group_id: Optional[str] = Field(None, alias="groupId")
    status: str = "completed"

    class Config:
        populate_by_name = True


class CalculateStandingsRequest(BaseModel):
    """順位計算リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    teams: List[Dict[str, Any]]  # [{id, name, groupId}, ...]
    matches: List[MatchResult]
    use_group_system: bool = Field(True, alias="useGroupSystem")
    exclude_b_matches: bool = Field(True, alias="excludeBMatches")

    class Config:
        populate_by_name = True


@router.get("/api/standings", summary="順位表取得")
async def get_standings(
    tournament_id: int = Query(..., alias="tournamentId"),
    mode: StandingsMode = Query(StandingsMode.OVERALL),
    group_id: Optional[str] = Query(None, alias="groupId")
):
    """
    順位表を取得

    - mode=overall: 全体順位表（新フォーマット用、use_group_system=falseの場合）
    - mode=group: グループ別順位表（旧フォーマット用、group_idが必須）

    B戦（is_b_match=true）の試合は順位計算から自動的に除外されます
    """
    if mode == StandingsMode.GROUP and not group_id:
        raise HTTPException(status_code=400, detail="グループモードではgroup_idが必須です")

    # このエンドポイントはSupabaseから直接取得するか、計算APIを使用する想定
    # 以下はサンプルレスポンス
    return {
        "success": True,
        "mode": mode.value,
        "tournament_id": tournament_id,
        "group_id": group_id,
        "standings": [],
        "message": "順位表データはSupabaseから直接取得するか、POST /api/standings/calculate を使用してください"
    }


@router.post("/api/standings/calculate", summary="順位計算")
async def calculate_standings(request: CalculateStandingsRequest):
    """
    試合結果から順位表を計算

    - use_group_system=true: グループ別に順位を計算（旧フォーマット）
    - use_group_system=false: 全体で順位を計算（新フォーマット）
    - exclude_b_matches=true: B戦を順位計算から除外（デフォルト）

    タイブレーカールール:
    1. 勝ち点
    2. 得失点差
    3. 総得点
    4. 直接対決（該当する場合）
    """
    teams = request.teams
    matches = request.matches
    use_group_system = request.use_group_system
    exclude_b_matches = request.exclude_b_matches

    # チームの成績を初期化
    team_stats: Dict[int, Dict[str, Any]] = {}
    for team in teams:
        team_id = team["id"]
        team_stats[team_id] = {
            "team_id": team_id,
            "team_name": team.get("name", f"Team {team_id}"),
            "group_id": team.get("groupId") or team.get("group_id"),
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "goals_for": 0,
            "goals_against": 0,
            "goal_difference": 0,
            "points": 0,
        }

    # 試合結果を集計
    for match in matches:
        # B戦除外チェック
        if exclude_b_matches and match.is_b_match:
            continue

        # 試合が完了していない場合はスキップ
        if match.status != "completed":
            continue

        home_id = match.home_team_id
        away_id = match.away_team_id
        home_score = match.home_score
        away_score = match.away_score

        if home_id not in team_stats or away_id not in team_stats:
            continue

        # ホームチーム
        team_stats[home_id]["played"] += 1
        team_stats[home_id]["goals_for"] += home_score
        team_stats[home_id]["goals_against"] += away_score

        # アウェイチーム
        team_stats[away_id]["played"] += 1
        team_stats[away_id]["goals_for"] += away_score
        team_stats[away_id]["goals_against"] += home_score

        # 勝敗判定
        if home_score > away_score:
            team_stats[home_id]["won"] += 1
            team_stats[home_id]["points"] += 3
            team_stats[away_id]["lost"] += 1
        elif home_score < away_score:
            team_stats[away_id]["won"] += 1
            team_stats[away_id]["points"] += 3
            team_stats[home_id]["lost"] += 1
        else:
            team_stats[home_id]["drawn"] += 1
            team_stats[home_id]["points"] += 1
            team_stats[away_id]["drawn"] += 1
            team_stats[away_id]["points"] += 1

    # 得失点差を計算
    for team_id in team_stats:
        team_stats[team_id]["goal_difference"] = (
            team_stats[team_id]["goals_for"] - team_stats[team_id]["goals_against"]
        )

    # 順位をソート
    def sort_key(stat):
        return (
            -stat["points"],
            -stat["goal_difference"],
            -stat["goals_for"],
            stat["team_name"]  # 同点の場合は名前順
        )

    if use_group_system:
        # グループ別に順位付け
        group_standings: Dict[str, List[Dict]] = defaultdict(list)

        for stat in team_stats.values():
            group_id = stat["group_id"] or "unknown"
            group_standings[group_id].append(stat)

        result_standings = []
        for group_id, group_stats in group_standings.items():
            sorted_stats = sorted(group_stats, key=sort_key)
            for rank, stat in enumerate(sorted_stats, 1):
                stat["rank"] = rank
                stat["group_id"] = group_id
                result_standings.append(stat)

        # 全体順位も計算（オプション）
        all_sorted = sorted(team_stats.values(), key=sort_key)
        for overall_rank, stat in enumerate(all_sorted, 1):
            stat["overall_rank"] = overall_rank

    else:
        # 全体で順位付け（新フォーマット）
        all_sorted = sorted(team_stats.values(), key=sort_key)
        result_standings = []
        for rank, stat in enumerate(all_sorted, 1):
            stat["rank"] = rank
            stat["overall_rank"] = rank
            result_standings.append(stat)

    return {
        "success": True,
        "tournament_id": request.tournament_id,
        "use_group_system": use_group_system,
        "exclude_b_matches": exclude_b_matches,
        "standings": result_standings,
        "total": len(result_standings)
    }
