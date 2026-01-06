from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import enum


class MatchStage(str, enum.Enum):
    preliminary = "preliminary"
    semifinal = "semifinal"
    third_place = "third_place"
    final = "final"
    training = "training"


class MatchStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    group_id = Column(String(1), nullable=True)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    match_date = Column(Date, nullable=True)
    match_time = Column(Time, nullable=True)
    stage = Column(Enum(MatchStage), nullable=True)
    status = Column(Enum(MatchStatus), default=MatchStatus.scheduled)
    home_score_half1 = Column(Integer, nullable=True)
    home_score_half2 = Column(Integer, nullable=True)
    home_score_total = Column(Integer, nullable=True)
    away_score_half1 = Column(Integer, nullable=True)
    away_score_half2 = Column(Integer, nullable=True)
    away_score_total = Column(Integer, nullable=True)

    tournament = relationship("Tournament", backref="matches")
    home_team = relationship("Team", foreign_keys=[home_team_id], backref="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], backref="away_matches")
