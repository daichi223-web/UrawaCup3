"""
試合スキーマ
"""

import logging
from datetime import date, time, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

logger = logging.getLogger(__name__)

from ..models import MatchStage, MatchStatus, ApprovalStatus


class MatchBase(BaseModel):
    """試合ベーススキーマ"""
    tournament_id: int
    group_id: Optional[str] = None
    venue_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None
    stage: MatchStage = MatchStage.preliminary


class MatchCreate(MatchBase):
    """試合作成スキーマ"""
    pass


class MatchUpdate(BaseModel):
    """試合更新スキーマ"""
    venue_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None
    stage: Optional[MatchStage] = None
    status: Optional[MatchStatus] = None


class GoalInput(BaseModel):
    """得点入力スキーマ"""
    team_id: int
    player_id: Optional[int] = None
    player_name: Optional[str] = Field(default=None, max_length=100)
    minute: int = Field(ge=0, le=120, description="得点時間（分）")
    half: int = Field(default=1, ge=1, le=2, description="1=前半, 2=後半")
    is_own_goal: bool = False
    is_penalty: bool = False


class ScoreInput(BaseModel):
    """スコア入力スキーマ"""
    home_score_half1: int = Field(default=0, ge=0, le=99, description="ホーム前半得点")
    home_score_half2: int = Field(default=0, ge=0, le=99, description="ホーム後半得点")
    away_score_half1: int = Field(default=0, ge=0, le=99, description="アウェイ前半得点")
    away_score_half2: int = Field(default=0, ge=0, le=99, description="アウェイ後半得点")
    home_pk: Optional[int] = Field(default=None, ge=0, le=99, description="ホームPKスコア")
    away_pk: Optional[int] = Field(default=None, ge=0, le=99, description="アウェイPKスコア")
    has_penalty_shootout: bool = False
    goals: List[GoalInput] = []  # 得点者リスト

    @model_validator(mode='after')
    def validate_pk_scores(self) -> 'ScoreInput':
        """PK戦スコアの整合性チェック"""
        if self.has_penalty_shootout:
            if self.home_pk is None or self.away_pk is None:
                raise ValueError("PK戦が行われた場合、両チームのPKスコアが必要です")
            if self.home_pk == self.away_pk:
                raise ValueError("PK戦のスコアは同点にはなりません")
        return self

    @model_validator(mode='after')
    def validate_score_consistency(self) -> 'ScoreInput':
        """得点者数と合計得点の整合性チェック（警告のみ）"""
        if self.goals:
            total_from_halves = (
                self.home_score_half1 + self.home_score_half2 +
                self.away_score_half1 + self.away_score_half2
            )
            if len(self.goals) != total_from_halves:
                logger.warning(
                    f"得点者数({len(self.goals)})と合計得点({total_from_halves})が一致しません。"
                    "オウンゴール等で一致しない場合があります。"
                )
        return self


class MatchResponse(BaseModel):
    """試合レスポンススキーマ"""
    id: int
    tournament_id: int
    group_id: Optional[str] = None
    venue_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None
    stage: MatchStage
    status: MatchStatus
    home_score_half1: int
    home_score_half2: int
    home_score_total: int
    away_score_half1: int
    away_score_half2: int
    away_score_total: int
    home_pk: Optional[int] = None
    away_pk: Optional[int] = None
    has_penalty_shootout: bool
    # 承認フロー
    approval_status: ApprovalStatus = ApprovalStatus.pending
    entered_by: Optional[int] = None
    entered_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MatchListResponse(BaseModel):
    """試合一覧レスポンス"""
    id: int
    group_id: Optional[str] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None
    stage: MatchStage
    status: MatchStatus
    home_score_total: int
    away_score_total: int
    approval_status: ApprovalStatus = ApprovalStatus.pending

    model_config = ConfigDict(from_attributes=True)


class LockResponse(BaseModel):
    """ロックレスポンス"""
    match_id: int
    locked: bool
    message: str


class FinalDayMatchUpdate(BaseModel):
    """最終日試合更新スキーマ（一括更新用）"""
    match_id: int
    venue_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None


class FinalDayScheduleUpdate(BaseModel):
    """最終日スケジュール一括更新スキーマ"""
    matches: List[FinalDayMatchUpdate]
