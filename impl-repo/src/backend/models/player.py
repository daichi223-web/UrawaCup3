"""
選手モデル
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Player(Base):
    """選手"""
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    number = Column(Integer)
    name = Column(String(50), nullable=False)
    name_kana = Column(String(100))
    grade = Column(Integer)
    position = Column(String(10))
    is_captain = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # リレーション
    team = relationship("Team", back_populates="players")
    goals = relationship("Goal", back_populates="player")
    awards = relationship("TournamentAward", back_populates="player")
