"""
エラーレスポンススキーマ - 統一されたエラー形式を定義
"""

from pydantic import BaseModel
from typing import Optional, Any


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
