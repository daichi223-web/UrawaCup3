"""
試合モデル
"""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Boolean, Date, Time, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from ..database import Base


class MatchStage(str, PyEnum):
    """試合ステージ"""
    preliminary = "preliminary"
    semifinal = "semifinal"
    third_place = "third_place"
    final = "final"
    training = "training"


class MatchStatus(str, PyEnum):
    """試合ステータス"""
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

    @classmethod
    def allowed_transitions(cls):
        """
        許可されるステータス遷移を定義

        状態遷移図:
          scheduled → in_progress, cancelled
          in_progress → completed, cancelled
          completed -> （基本は変更不可、approval_statusがpendingの場合のみin_progressへ戻すことが可能）
          cancelled -> scheduled（再開の場合）
        """
        return {
            cls.scheduled: [cls.in_progress, cls.cancelled],
            cls.in_progress: [cls.completed, cls.cancelled],
            cls.completed: [cls.in_progress],  # 条件付き（approval_status=pending時のみ）
            cls.cancelled: [cls.scheduled],  # 再開の場合
        }

    @classmethod
    def can_transition(cls, from_status: "MatchStatus", to_status: "MatchStatus") -> bool:
        """ステータス遷移が許可されているかチェック"""
        if from_status == to_status:
            return True
        allowed = cls.allowed_transitions().get(from_status, [])
        return to_status in allowed


class ApprovalStatus(str, PyEnum):
    """承認ステータス"""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Match(Base):
    """試合"""
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    group_id = Column(String(1), nullable=True)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    match_date = Column(Date)
    match_time = Column(Time)
    stage = Column(Enum(MatchStage), default=MatchStage.preliminary)
    status = Column(Enum(MatchStatus), default=MatchStatus.scheduled)
    # スコア
    home_score_half1 = Column(Integer, default=0)
    home_score_half2 = Column(Integer, default=0)
    home_score_total = Column(Integer, default=0)
    away_score_half1 = Column(Integer, default=0)
    away_score_half2 = Column(Integer, default=0)
    away_score_total = Column(Integer, default=0)
    # PK戦
    home_pk = Column(Integer, nullable=True)
    away_pk = Column(Integer, nullable=True)
    has_penalty_shootout = Column(Boolean, default=False)

    # 承認フロー
    approval_status = Column(Enum(ApprovalStatus), default=ApprovalStatus.pending)
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String(500), nullable=True)

    # リレーション
    tournament = relationship("Tournament", back_populates="matches")
    venue = relationship("Venue", back_populates="matches")
    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
    goals = relationship("Goal", back_populates="match", cascade="all, delete-orphan")
    lock = relationship("MatchLock", back_populates="match", uselist=False, cascade="all, delete-orphan")
