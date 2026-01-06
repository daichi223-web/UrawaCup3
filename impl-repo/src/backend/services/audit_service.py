"""
監査ログサービス
"""

from typing import Optional, Union
import json

from sqlalchemy.orm import Session

from ..models.audit_log import AuditLog, ActionType


def log_action(
    db: Session,
    user_id: Optional[int],
    action: ActionType,
    entity_type: str,
    entity_id: Optional[int] = None,
    old_value: Optional[Union[dict, str]] = None,
    new_value: Optional[Union[dict, str]] = None,
    ip_address: Optional[str] = None
) -> AuditLog:
    """
    監査ログを記録する

    Args:
        db: データベースセッション
        user_id: 操作を行ったユーザーのID（未認証の場合はNone）
        action: アクションタイプ（CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE, REJECT）
        entity_type: 対象エンティティの種類（例: "User", "Match", "Team"）
        entity_id: 対象エンティティのID
        old_value: 変更前の値（dict または JSON文字列）
        new_value: 変更後の値（dict または JSON文字列）
        ip_address: クライアントのIPアドレス

    Returns:
        作成されたAuditLogオブジェクト
    """
    # dictの場合はJSON文字列に変換
    old_value_str = None
    new_value_str = None

    if old_value is not None:
        if isinstance(old_value, dict):
            old_value_str = json.dumps(old_value, ensure_ascii=False)
        else:
            old_value_str = str(old_value)

    if new_value is not None:
        if isinstance(new_value, dict):
            new_value_str = json.dumps(new_value, ensure_ascii=False)
        else:
            new_value_str = str(new_value)

    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value_str,
        new_value=new_value_str,
        ip_address=ip_address
    )

    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    return audit_log
