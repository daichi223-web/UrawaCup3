"""
表彰モデル
"""

from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from ..database import Base


class AwardType(str, PyEnum):
    """表彰種別"""
    mvp = "mvp"
    best_gk = "best_gk"
    top_scorer = "top_scorer"
    fair_play = "fair_play"


class TournamentAward(Base):
    """表彰テーブル"""
    __tablename__ = "tournament_awards"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    award_type = Column(Enum(AwardType), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    description = Column(String(200))

    # リレーション
    tournament = relationship("Tournament", back_populates="awards")
    player = relationship("Player", back_populates="awards")
    team = relationship("Team", back_populates="awards")
