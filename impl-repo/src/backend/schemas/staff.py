"""
スタッフスキーマ
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict

from ..models import StaffRole


class StaffBase(BaseModel):
    """スタッフベーススキーマ"""
    name: str
    role: StaffRole
    phone: Optional[str] = None
    email: Optional[str] = None


class StaffCreate(StaffBase):
    """スタッフ作成スキーマ"""
    team_id: int


class StaffUpdate(BaseModel):
    """スタッフ更新スキーマ"""
    name: Optional[str] = None
    role: Optional[StaffRole] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class StaffResponse(StaffBase):
    """スタッフレスポンススキーマ"""
    id: int
    team_id: int

    model_config = ConfigDict(from_attributes=True)
