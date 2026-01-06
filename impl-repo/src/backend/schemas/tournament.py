"""
大会スキーマ
"""

from datetime import date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class TournamentBase(BaseModel):
    """大会ベーススキーマ"""
    name: str
    edition: Optional[int] = None
    year: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    match_duration: int = 50
    half_duration: int = 25
    interval_minutes: int = 15
    sender_organization: Optional[str] = None
    sender_name: Optional[str] = None
    sender_contact: Optional[str] = None


class TournamentCreate(TournamentBase):
    """大会作成スキーマ"""
    pass


class TournamentUpdate(BaseModel):
    """大会更新スキーマ"""
    name: Optional[str] = None
    edition: Optional[int] = None
    year: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    match_duration: Optional[int] = None
    half_duration: Optional[int] = None
    interval_minutes: Optional[int] = None
    sender_organization: Optional[str] = None
    sender_name: Optional[str] = None
    sender_contact: Optional[str] = None


class GroupResponse(BaseModel):
    """グループレスポンス"""
    id: str
    name: Optional[str] = None
    venue_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class TournamentResponse(TournamentBase):
    """大会レスポンススキーマ"""
    id: int
    groups: List[GroupResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TournamentListResponse(BaseModel):
    """大会一覧レスポンス"""
    id: int
    name: str
    edition: Optional[int] = None
    year: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)
