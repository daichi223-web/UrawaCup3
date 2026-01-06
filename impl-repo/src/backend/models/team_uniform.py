"""
ユニフォームモデル
"""

from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy.orm import relationship

from ..database import Base


class UniformType(str, PyEnum):
    """ユニフォーム種別"""
    fp_main = "fp_main"
    fp_sub = "fp_sub"
    gk_main = "gk_main"
    gk_sub = "gk_sub"


class TeamUniform(Base):
    """ユニフォームテーブル"""
    __tablename__ = "team_uniforms"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    uniform_type = Column(Enum(UniformType), nullable=False)
    shirt_color = Column(String(30))
    pants_color = Column(String(30))
    socks_color = Column(String(30))

    # リレーション
    team = relationship("Team", back_populates="uniforms")
