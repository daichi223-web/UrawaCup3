"""
選手スキーマ
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class PlayerBase(BaseModel):
    """選手ベーススキーマ"""
    number: Optional[int] = None
    name: str
    name_kana: Optional[str] = None
    grade: Optional[int] = None
    position: Optional[str] = None
    is_captain: bool = False


class PlayerCreate(PlayerBase):
    """選手作成スキーマ"""
    team_id: int


class PlayerUpdate(BaseModel):
    """選手更新スキーマ"""
    number: Optional[int] = None
    name: Optional[str] = None
    name_kana: Optional[str] = None
    grade: Optional[int] = None
    position: Optional[str] = None
    is_captain: Optional[bool] = None


class PlayerResponse(PlayerBase):
    """選手レスポンススキーマ"""
    id: int
    team_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PlayerListResponse(BaseModel):
    """選手一覧レスポンス"""
    id: int
    team_id: int
    number: Optional[int] = None
    name: str
    position: Optional[str] = None
    is_captain: bool

    model_config = ConfigDict(from_attributes=True)


class PlayerSuggest(BaseModel):
    """選手サジェスト用"""
    id: int
    number: Optional[int] = None
    name: str
    team_id: int
    team_name: Optional[str] = None
