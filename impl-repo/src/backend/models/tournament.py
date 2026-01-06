from sqlalchemy import Column, Integer, String, Date
from database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    edition = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    match_duration = Column(Integer, default=50)
    half_duration = Column(Integer, default=25)
    interval_minutes = Column(Integer, default=15)
