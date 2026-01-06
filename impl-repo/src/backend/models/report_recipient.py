"""
報告書送信先モデル
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class ReportRecipient(Base):
    """報告書送信先テーブル"""
    __tablename__ = "report_recipients"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    organization = Column(String(100), nullable=False)
    recipient_name = Column(String(50))
    email = Column(String(100))
    send_daily = Column(Boolean, default=True)
    send_final = Column(Boolean, default=True)

    # リレーション
    tournament = relationship("Tournament", back_populates="report_recipients")
