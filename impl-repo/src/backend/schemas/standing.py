"""
順位表スキーマ
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class StandingBase(BaseModel):
    """順位表ベーススキーマ"""
    tournament_id: int
    group_id: str
    team_id: int


class StandingResponse(BaseModel):
    """順位表レスポンス"""
    id: int
    tournament_id: int
    group_id: str
    team_id: int
    rank: int
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    last_updated: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StandingWithTeam(StandingResponse):
    """チーム情報付き順位表レスポンス"""
    team_name: Optional[str] = None
    team_short_name: Optional[str] = None


class GroupStandings(BaseModel):
    """グループ順位表"""
    group_id: str
    standings: List[StandingResponse]


class ScorerRanking(BaseModel):
    """得点ランキング"""
    rank: int
    player_id: Optional[int] = None
    player_name: str
    team_id: int
    team_name: str
    goals: int
