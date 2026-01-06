"""
ユーザーモデル
"""

from enum import Enum as PyEnum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from ..database import Base


class UserRole(str, PyEnum):
    """ユーザー権限"""
    admin = "admin"
    venue_staff = "venue_staff"
    viewer = "viewer"


class User(Base):
    """ユーザーテーブル"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(50))
    role = Column(Enum(UserRole), default=UserRole.viewer)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # リレーション
    venue = relationship("Venue")
    match_locks = relationship("MatchLock", back_populates="user")
