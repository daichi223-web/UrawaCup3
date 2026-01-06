"""
チームモデル
"""

from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from ..database import Base


class TeamType(str, PyEnum):
    """チームタイプ"""
    local = "local"
    invited = "invited"


class Team(Base):
    """チーム"""
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    group_id = Column(String(1), ForeignKey("groups.id"), nullable=True)
    name = Column(String(100), nullable=False)
    short_name = Column(String(20))
    prefecture = Column(String(20))
    team_type = Column(Enum(TeamType), default=TeamType.invited)
    is_host = Column(Boolean, default=False)
    group_order = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # リレーション
    tournament = relationship("Tournament", back_populates="teams")
    group = relationship("Group", back_populates="teams")
    players = relationship("Player", back_populates="team", cascade="all, delete-orphan")
    staff = relationship("Staff", back_populates="team", cascade="all, delete-orphan")
    uniforms = relationship("TeamUniform", back_populates="team", cascade="all, delete-orphan")
    home_matches = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
    goals = relationship("Goal", back_populates="team")
    standing = relationship("Standing", back_populates="team", uselist=False)
    awards = relationship("TournamentAward", back_populates="team")
