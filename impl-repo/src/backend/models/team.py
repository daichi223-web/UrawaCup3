from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import enum


class TeamType(str, enum.Enum):
    local = "local"
    invited = "invited"


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    group_id = Column(String(1), ForeignKey("groups.id"), nullable=True)
    name = Column(String(100), nullable=False)
    short_name = Column(String(20), nullable=True)
    prefecture = Column(String(20), nullable=True)
    team_type = Column(Enum(TeamType), nullable=True)
    is_host = Column(Boolean, default=False)
    group_order = Column(Integer, nullable=True)

    tournament = relationship("Tournament", backref="teams")
    group = relationship("Group", backref="teams")
