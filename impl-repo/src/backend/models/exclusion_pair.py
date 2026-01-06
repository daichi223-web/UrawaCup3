"""
対戦除外ペアモデル
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class ExclusionPair(Base):
    """対戦除外ペアテーブル"""
    __tablename__ = "exclusion_pairs"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    group_id = Column(String(1), nullable=False)
    team1_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team2_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    reason = Column(String(200))

    # リレーション
    tournament = relationship("Tournament", back_populates="exclusion_pairs")
    team1 = relationship("Team", foreign_keys=[team1_id])
    team2 = relationship("Team", foreign_keys=[team2_id])
