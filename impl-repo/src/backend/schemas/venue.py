"""
会場スキーマ
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict


class VenueBase(BaseModel):
    """会場ベーススキーマ"""
    name: str
    short_name: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[int] = None
    has_night_lighting: bool = False
    max_matches_per_day: int = 6
    is_final_venue: bool = False


class VenueCreate(VenueBase):
    """会場作成スキーマ"""
    tournament_id: int


class VenueUpdate(BaseModel):
    """会場更新スキーマ"""
    name: Optional[str] = None
    short_name: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[int] = None
    has_night_lighting: Optional[bool] = None
    max_matches_per_day: Optional[int] = None
    is_final_venue: Optional[bool] = None


class VenueResponse(VenueBase):
    """会場レスポンススキーマ"""
    id: int
    tournament_id: int

    model_config = ConfigDict(from_attributes=True)
