"""
認証サービス
"""

import os
import secrets
import warnings
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..models import User

# 設定
_DEFAULT_SECRET = "your-secret-key-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", "")

# セキュリティチェック: 本番環境ではSECRET_KEYの設定が必須
if not SECRET_KEY:
    if os.getenv("ENV", "development") == "production":
        raise RuntimeError(
            "SECRET_KEY環境変数が設定されていません。"
            "本番環境では必ず安全なシークレットキーを設定してください。"
            "生成例: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    # 開発環境ではデフォルト値を使用（警告付き）
    SECRET_KEY = _DEFAULT_SECRET
    warnings.warn(
        "SECRET_KEY未設定のため開発用デフォルトキーを使用中。"
        "本番環境では必ずSECRET_KEY環境変数を設定してください。",
        UserWarning
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# パスワードハッシュ
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """パスワード検証"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """パスワードハッシュ化"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """アクセストークン生成"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """リフレッシュトークン生成"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """トークンをデコード"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """ユーザー認証"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """IDでユーザーを取得"""
    return db.query(User).filter(User.id == user_id).first()
