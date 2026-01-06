"""
認証スキーマ
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict

from ..models import UserRole


class LoginRequest(BaseModel):
    """ログインリクエスト"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """トークンレスポンス"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """リフレッシュリクエスト"""
    refresh_token: str


class UserResponse(BaseModel):
    """ユーザーレスポンス"""
    id: int
    username: str
    display_name: Optional[str] = None
    role: UserRole
    venue_id: Optional[int] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    """ユーザー作成"""
    username: str
    password: str
    display_name: Optional[str] = None
    role: UserRole = UserRole.viewer
    venue_id: Optional[int] = None
