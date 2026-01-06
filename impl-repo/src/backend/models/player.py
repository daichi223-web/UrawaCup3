from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    number = Column(Integer, nullable=True)
    name = Column(String(50), nullable=False)
    name_kana = Column(String(100), nullable=True)
    grade = Column(Integer, nullable=True)
    position = Column(String(10), nullable=True)
    is_captain = Column(Boolean, default=False)

    team = relationship("Team", backref="players")
