"""
試合ロックモデル
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class MatchLock(Base):
    """試合ロックテーブル（同時編集防止）"""
    __tablename__ = "match_locks"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    locked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(minutes=5))

    # リレーション
    match = relationship("Match", back_populates="lock")
    user = relationship("User", back_populates="match_locks")
