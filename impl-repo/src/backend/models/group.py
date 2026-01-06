from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(String(1), primary_key=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    name = Column(String(50), nullable=False)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)

    tournament = relationship("Tournament", backref="groups")
