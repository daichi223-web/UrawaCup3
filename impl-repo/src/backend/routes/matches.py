"""
試合管理API

試合ステータスの状態遷移:
  - scheduled → in_progress, cancelled
  - in_progress → completed, cancelled
  - completed -> （変更不可、approval_statusがpendingの場合のみin_progressへ戻すことが可能）
  - cancelled -> scheduled（再開の場合）

不正な状態遷移はHTTP 422 (Unprocessable Entity) で拒否されます。
"""

import asyncio
import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional, Dict, Set
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Match, MatchStatus, MatchStage, MatchLock, Venue, ApprovalStatus, Goal

logger = logging.getLogger(__name__)

# 許可される状態遷移マップ
# キー: 現在のステータス、値: 遷移可能なステータスのセット
ALLOWED_STATUS_TRANSITIONS: Dict[MatchStatus, Set[MatchStatus]] = {
    MatchStatus.scheduled: {MatchStatus.in_progress, MatchStatus.cancelled},
    MatchStatus.in_progress: {MatchStatus.completed, MatchStatus.cancelled},
    MatchStatus.completed: {MatchStatus.in_progress},  # 条件付き（approval_status=pending時のみ）
    MatchStatus.cancelled: {MatchStatus.scheduled},  # 再開の場合
}
from ..utils.websocket import manager
from ..schemas.match import (
    MatchCreate,
    MatchUpdate,
    MatchResponse,
    MatchListResponse,
    ScoreInput,
    GoalInput,
    LockResponse,
)
from ..services.schedule import (
    generate_preliminary_schedule,
    generate_finals_schedule,
    generate_training_matches,
)

router = APIRouter()


def _run_async(coro):
    """非同期処理をバックグラウンドで実行"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(coro)
        else:
            loop.run_until_complete(coro)
    except RuntimeError:
        asyncio.run(coro)



def validate_status_transition(
    current_status: MatchStatus,
    new_status: MatchStatus,
    approval_status: Optional[ApprovalStatus] = None
) -> bool:
    """
    状態遷移のバリデーションを行う

    Args:
        current_status: 現在のステータス
        new_status: 遷移先のステータス
        approval_status: 承認ステータス（completedからの遷移時に考慮）

    Returns:
        bool: 遷移が許可されている場合はTrue

    Raises:
        HTTPException: 不正な状態遷移の場合 (HTTP 422)
    """
    # 同じステータスへの遷移は許可
    if current_status == new_status:
        return True

    allowed = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())

    # completedからの遷移は条件付き
    if current_status == MatchStatus.completed:
        # approval_statusがpendingの場合のみin_progressへの遷移を許可
        if new_status == MatchStatus.in_progress:
            if approval_status == ApprovalStatus.pending:
                return True
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"ステータスを {current_status.value} から {new_status.value} に変更することはできません（承認済みまたは却下済みの試合は変更不可）"
                )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"ステータスを {current_status.value} から {new_status.value} に変更することはできません"
        )

    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"ステータスを {current_status.value} から {new_status.value} に変更することはできません"
        )

    return True


@router.get("", response_model=List[MatchListResponse])
def get_matches(
    tournament_id: Optional[int] = Query(None),
    group_id: Optional[str] = Query(None),
    match_date: Optional[str] = Query(None),
    status: Optional[MatchStatus] = Query(None),
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db)
):
    """試合一覧取得"""
    query = db.query(Match)

    if tournament_id:
        query = query.filter(Match.tournament_id == tournament_id)
    if group_id:
        query = query.filter(Match.group_id == group_id)
    if match_date:
        query = query.filter(Match.match_date == match_date)
    if status:
        query = query.filter(Match.status == status)

    matches = query.order_by(Match.match_date, Match.match_time).offset(skip).limit(limit).all()
    return matches


@router.post("", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def create_match(
    match: MatchCreate,
    db: Session = Depends(get_db)
):
    """試合作成"""
    db_match = Match(**match.model_dump())
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match


@router.get("/pending", response_model=List[MatchListResponse])
def get_pending_matches(
    tournament_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """承認待ち試合一覧を取得"""
    query = db.query(Match).filter(
        Match.status == MatchStatus.completed,
        Match.approval_status == ApprovalStatus.pending
    )
    if tournament_id:
        query = query.filter(Match.tournament_id == tournament_id)

    return query.order_by(Match.match_date, Match.match_time).all()


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(
    match_id: int,
    db: Session = Depends(get_db)
):
    """試合詳細取得"""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )
    return match


@router.put("/{match_id}", response_model=MatchResponse)
def update_match(
    match_id: int,
    match_update: MatchUpdate,
    db: Session = Depends(get_db)
):
    """試合更新"""
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )

    update_data = match_update.model_dump(exclude_unset=True)

    # ステータス変更時の遷移チェック
    if "status" in update_data and update_data["status"] is not None:
        new_status = MatchStatus(update_data["status"])
        validate_status_transition(match.status, new_status, match.approval_status)

    for field, value in update_data.items():
        setattr(match, field, value)

    db.commit()
    db.refresh(match)
    return match


@router.put("/{match_id}/score", response_model=MatchResponse)
def update_score(
    match_id: int,
    score: ScoreInput,
    user_id: int = Query(None, description="入力者ユーザーID"),
    db: Session = Depends(get_db)
):
    """
    スコア入力
    - 前半/後半スコアから合計を自動計算
    - ステータスを完了に変更
    - 得点者情報も同時に登録
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )

    # ステータス遷移チェック（キャンセル済み・完了済みの試合はスコア入力不可）
    validate_status_transition(match.status, MatchStatus.completed, match.approval_status)

    # スコア設定
    match.home_score_half1 = score.home_score_half1
    match.home_score_half2 = score.home_score_half2
    match.away_score_half1 = score.away_score_half1
    match.away_score_half2 = score.away_score_half2

    # 合計自動計算
    match.home_score_total = score.home_score_half1 + score.home_score_half2
    match.away_score_total = score.away_score_half1 + score.away_score_half2

    # PK戦
    match.home_pk = score.home_pk
    match.away_pk = score.away_pk
    match.has_penalty_shootout = score.has_penalty_shootout

    # ステータス更新
    match.status = MatchStatus.completed
    match.approval_status = ApprovalStatus.pending
    if user_id:
        match.entered_by = user_id
        match.entered_at = datetime.now(timezone.utc)

    # 既存の得点を削除
    db.query(Goal).filter(Goal.match_id == match_id).delete()

    # 新しい得点を登録
    for goal_input in score.goals:
        goal = Goal(
            match_id=match_id,
            team_id=goal_input.team_id,
            player_id=goal_input.player_id,
            scorer_name=goal_input.player_name,
            minute=goal_input.minute,
            half=goal_input.half,
            is_own_goal=goal_input.is_own_goal,
            is_penalty=goal_input.is_penalty,
        )
        db.add(goal)

    db.commit()
    db.refresh(match)

    # WebSocket通知
    _run_async(manager.send_match_update(
        match.tournament_id,
        match_id,
        {
            "home_score_total": match.home_score_total,
            "away_score_total": match.away_score_total,
            "status": match.status.value,
            "approval_status": match.approval_status.value
        }
    ))

    return match


@router.post("/{match_id}/lock", response_model=LockResponse)
def lock_match(
    match_id: int,
    user_id: int = Query(..., description="ロック取得ユーザーID"),
    db: Session = Depends(get_db)
):
    """
    試合ロック取得（同時編集防止）
    - 5分間有効
    - 既にロックされている場合はエラー
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )

    # 既存ロックチェック
    existing_lock = db.query(MatchLock).filter(MatchLock.match_id == match_id).first()

    if existing_lock:
        # 期限切れチェック
        if existing_lock.expires_at > datetime.now(timezone.utc):
            if existing_lock.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="他のユーザーが編集中です"
                )
            # 同じユーザーなら延長
            existing_lock.expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
            db.commit()
            return LockResponse(match_id=match_id, locked=True, message="ロックを延長しました")
        else:
            # 期限切れなので削除
            db.delete(existing_lock)

    # 新規ロック作成
    new_lock = MatchLock(
        match_id=match_id,
        user_id=user_id,
        locked_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
    )
    db.add(new_lock)
    db.commit()

    # WebSocket通知
    _run_async(manager.send_match_locked(match.tournament_id, match_id, user_id, True))

    return LockResponse(match_id=match_id, locked=True, message="ロックを取得しました")


@router.delete("/{match_id}/lock", response_model=LockResponse)
def unlock_match(
    match_id: int,
    user_id: int = Query(..., description="ロック解除ユーザーID"),
    db: Session = Depends(get_db)
):
    """試合ロック解除"""
    match = db.query(Match).filter(Match.id == match_id).first()
    lock = db.query(MatchLock).filter(MatchLock.match_id == match_id).first()

    if not lock:
        return LockResponse(match_id=match_id, locked=False, message="ロックは存在しません")

    if lock.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="他のユーザーのロックは解除できません"
        )

    db.delete(lock)
    db.commit()

    # WebSocket通知
    if match:
        _run_async(manager.send_match_locked(match.tournament_id, match_id, user_id, False))

    return LockResponse(match_id=match_id, locked=False, message="ロックを解除しました")


@router.post("/generate-schedule/{tournament_id}")
def generate_schedule(
    tournament_id: int,
    start_date: date = Query(..., description="開始日"),
    matches_per_day: int = Query(6, description="1日あたりの試合数"),
    db: Session = Depends(get_db)
):
    """
    予選リーグ日程を自動生成
    - 各グループ6チームの変則リーグ（対戦除外あり）
    """
    matches = generate_preliminary_schedule(
        db=db,
        tournament_id=tournament_id,
        start_date=start_date,
        matches_per_day=matches_per_day
    )
    return {"message": f"{len(matches)}試合の日程を生成しました", "count": len(matches)}


@router.post("/generate-finals/{tournament_id}")
def generate_finals(
    tournament_id: int,
    final_date: date = Query(..., description="決勝日"),
    final_venue_id: int = Query(..., description="決勝会場ID"),
    force: bool = Query(False, description="未完了試合があっても強制生成"),
    db: Session = Depends(get_db)
):
    """
    決勝トーナメント日程を生成
    - 準決勝2試合 + 3位決定戦 + 決勝
    - 全予選試合が完了していない場合はエラー（force=trueで強制生成可能）
    """
    # 予選試合の存在チェック
    preliminary_count = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage == MatchStage.preliminary
    ).count()

    if preliminary_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="予選リーグの試合が存在しません。先に予選日程を生成してください"
        )

    # 未完了試合のチェック
    incomplete_count = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage == MatchStage.preliminary,
        Match.status != MatchStatus.completed
    ).count()

    if incomplete_count > 0 and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"予選リーグに未完了の試合が {incomplete_count}件 あります。全試合完了後に決勝トーナメントを生成してください"
        )

    if incomplete_count > 0 and force:
        logger.warning(
            f"Tournament {tournament_id}: 予選リーグに未完了の試合が {incomplete_count}件 ありますが、強制生成が指定されたため決勝トーナメントを生成します"
        )

    matches = generate_finals_schedule(
        db=db,
        tournament_id=tournament_id,
        final_date=final_date,
        final_venue_id=final_venue_id
    )
    return {"message": f"{len(matches)}試合の決勝T日程を生成しました", "count": len(matches)}


@router.post("/generate-training/{tournament_id}")
def generate_training(
    tournament_id: int,
    final_date: date = Query(..., description="最終日"),
    db: Session = Depends(get_db)
):
    """
    研修試合日程を生成
    - 2〜6位チーム同士の対戦
    - 予選未対戦チームを優先
    """
    matches = generate_training_matches(
        db=db,
        tournament_id=tournament_id,
        final_date=final_date
    )
    return {"message": f"{len(matches)}試合の研修試合日程を生成しました", "count": len(matches)}


# ==================== 承認フロー ====================

@router.post("/{match_id}/approve", response_model=MatchResponse)
def approve_match(
    match_id: int,
    user_id: int = Query(..., description="承認者ユーザーID"),
    db: Session = Depends(get_db)
):
    """
    試合結果を承認
    - 管理者のみ実行可能
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )

    if match.status != MatchStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="完了していない試合は承認できません"
        )

    if match.approval_status == ApprovalStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="既に承認済みです"
        )

    match.approval_status = ApprovalStatus.approved
    match.approved_by = user_id
    match.approved_at = datetime.now(timezone.utc)
    match.rejection_reason = None

    db.commit()
    db.refresh(match)

    # 順位表を更新
    from ..services.standings import recalculate_standings
    recalculate_standings(db, match.tournament_id, match.group_id)

    # WebSocket通知
    _run_async(manager.send_approval_update(
        match.tournament_id, match_id, "approved"
    ))
    _run_async(manager.send_standing_update(
        match.tournament_id, match.group_id, {"updated": True}
    ))

    return match


@router.post("/{match_id}/reject", response_model=MatchResponse)
def reject_match(
    match_id: int,
    user_id: int = Query(..., description="却下者ユーザーID"),
    reason: str = Query(..., description="却下理由"),
    db: Session = Depends(get_db)
):
    """
    試合結果を却下
    - 管理者のみ実行可能
    - 却下理由は必須
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )

    if match.status != MatchStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="完了していない試合は却下できません"
        )

    match.approval_status = ApprovalStatus.rejected
    match.approved_by = user_id
    match.approved_at = datetime.now(timezone.utc)
    match.rejection_reason = reason

    db.commit()
    db.refresh(match)

    # WebSocket通知
    _run_async(manager.send_approval_update(
        match.tournament_id, match_id, "rejected"
    ))

    return match


@router.post("/{match_id}/resubmit", response_model=MatchResponse)
def resubmit_match(
    match_id: int,
    score: ScoreInput,
    user_id: int = Query(..., description="再提出ユーザーID"),
    db: Session = Depends(get_db)
):
    """
    却下された試合結果を修正して再提出
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="試合が見つかりません"
        )

    if match.approval_status != ApprovalStatus.rejected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="却下された試合のみ再提出できます"
        )

    # スコア更新
    match.home_score_half1 = score.home_score_half1
    match.home_score_half2 = score.home_score_half2
    match.away_score_half1 = score.away_score_half1
    match.away_score_half2 = score.away_score_half2
    match.home_score_total = score.home_score_half1 + score.home_score_half2
    match.away_score_total = score.away_score_half1 + score.away_score_half2
    match.home_pk = score.home_pk
    match.away_pk = score.away_pk
    match.has_penalty_shootout = score.has_penalty_shootout

    # 承認ステータスをpendingに戻す
    match.approval_status = ApprovalStatus.pending
    match.entered_by = user_id
    match.entered_at = datetime.now(timezone.utc)
    match.rejection_reason = None

    db.commit()
    db.refresh(match)

    # WebSocket通知
    _run_async(manager.send_approval_update(
        match.tournament_id, match_id, "pending"
    ))
    _run_async(manager.send_match_update(
        match.tournament_id, match_id,
        {
            "home_score_total": match.home_score_total,
            "away_score_total": match.away_score_total,
            "status": match.status.value,
            "approval_status": "pending"
        }
    ))

    return match
