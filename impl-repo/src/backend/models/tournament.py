"""
大会モデル
"""

from sqlalchemy import Column, Integer, String, Date
from sqlalchemy.orm import relationship

from ..database import Base


class Tournament(Base):
    """大会情報"""
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    edition = Column(Integer)
    year = Column(Integer)
    start_date = Column(Date)
    end_date = Column(Date)
    match_duration = Column(Integer, default=50)
    half_duration = Column(Integer, default=25)
    interval_minutes = Column(Integer, default=15)
    # 発信元情報
    sender_organization = Column(String(100))
    sender_name = Column(String(50))
    sender_contact = Column(String(50))

    # リレーション
    groups = relationship("Group", back_populates="tournament", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="tournament", cascade="all, delete-orphan")
    venues = relationship("Venue", back_populates="tournament", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="tournament", cascade="all, delete-orphan")
    standings = relationship("Standing", back_populates="tournament", cascade="all, delete-orphan")
    exclusion_pairs = relationship("ExclusionPair", back_populates="tournament", cascade="all, delete-orphan")
    awards = relationship("TournamentAward", back_populates="tournament", cascade="all, delete-orphan")
    report_recipients = relationship("ReportRecipient", back_populates="tournament", cascade="all, delete-orphan")
