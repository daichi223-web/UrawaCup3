"""
スタッフモデル
"""

from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from ..database import Base


class StaffRole(str, PyEnum):
    """スタッフ役割"""
    manager = "manager"
    coach = "coach"
    accompanying_referee = "accompanying_referee"


class Staff(Base):
    """スタッフテーブル"""
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    name = Column(String(50), nullable=False)
    role = Column(Enum(StaffRole), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))

    # リレーション
    team = relationship("Team", back_populates="staff")
