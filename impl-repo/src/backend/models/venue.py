"""
会場モデル
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class Venue(Base):
    """会場テーブル"""
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    name = Column(String(100), nullable=False)
    short_name = Column(String(20))
    address = Column(String(200))
    capacity = Column(Integer)
    has_night_lighting = Column(Boolean, default=False)
    max_matches_per_day = Column(Integer, default=6)
    is_final_venue = Column(Boolean, default=False)

    # リレーション
    tournament = relationship("Tournament", back_populates="venues")
    groups = relationship("Group", back_populates="venue")
    matches = relationship("Match", back_populates="venue")
