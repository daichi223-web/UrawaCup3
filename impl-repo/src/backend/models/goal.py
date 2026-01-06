"""
得点モデル
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Goal(Base):
    """得点テーブル"""
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    scorer_name = Column(String(50))  # 手入力用
    minute = Column(Integer, nullable=False)
    half = Column(Integer, nullable=False)  # 1=前半, 2=後半
    is_own_goal = Column(Boolean, default=False)
    is_penalty = Column(Boolean, default=False)

    # リレーション
    match = relationship("Match", back_populates="goals")
    team = relationship("Team", back_populates="goals")
    player = relationship("Player", back_populates="goals")
