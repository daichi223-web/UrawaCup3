"""
チームスキーマ
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from ..models import TeamType


class TeamBase(BaseModel):
    """チームベーススキーマ"""
    name: str
    short_name: Optional[str] = None
    prefecture: Optional[str] = None
    team_type: TeamType = TeamType.invited
    is_host: bool = False
    group_order: Optional[int] = None


class TeamCreate(TeamBase):
    """チーム作成スキーマ"""
    tournament_id: int
    group_id: Optional[str] = None


class TeamUpdate(BaseModel):
    """チーム更新スキーマ"""
    name: Optional[str] = None
    short_name: Optional[str] = None
    prefecture: Optional[str] = None
    team_type: Optional[TeamType] = None
    is_host: Optional[bool] = None
    group_id: Optional[str] = None
    group_order: Optional[int] = None


class TeamResponse(TeamBase):
    """チームレスポンススキーマ"""
    id: int
    tournament_id: int
    group_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TeamListResponse(BaseModel):
    """チーム一覧レスポンス"""
    id: int
    name: str
    short_name: Optional[str] = None
    group_id: Optional[str] = None
    team_type: TeamType
    is_host: bool

    model_config = ConfigDict(from_attributes=True)


class TeamCSVImport(BaseModel):
    """CSVインポート用"""
    tournament_id: int
    group_id: str
    name: str
    short_name: Optional[str] = None
    prefecture: Optional[str] = None
    team_type: str = "invited"
    is_host: bool = False
