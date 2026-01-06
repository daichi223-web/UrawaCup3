"""
グループモデル
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Group(Base):
    """グループ（A〜D）"""
    __tablename__ = "groups"

    id = Column(String(1), primary_key=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    name = Column(String(50))
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)

    # リレーション
    tournament = relationship("Tournament", back_populates="groups")
    venue = relationship("Venue", back_populates="groups")
    teams = relationship("Team", back_populates="group")
