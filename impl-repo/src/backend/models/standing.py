"""
順位表モデル
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Standing(Base):
    """順位表テーブル"""
    __tablename__ = "standings"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    group_id = Column(String(1), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    rank = Column(Integer, default=0)
    rank_reason = Column(String(100), nullable=True)  # 順位決定理由（抽選、直接対決など）
    played = Column(Integer, default=0)
    won = Column(Integer, default=0)
    drawn = Column(Integer, default=0)
    lost = Column(Integer, default=0)
    goals_for = Column(Integer, default=0)
    goals_against = Column(Integer, default=0)
    goal_difference = Column(Integer, default=0)
    points = Column(Integer, default=0)
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # リレーション
    tournament = relationship("Tournament", back_populates="standings")
    team = relationship("Team", back_populates="standing")
