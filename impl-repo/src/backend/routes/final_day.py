"""
Final Day Routes - 最終日関連のエンドポイント
"""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.match import Match, MatchStage

logger = logging.getLogger(__name__)
from ..services.final_day import FinalDayService
from ..schemas.match import MatchResponse, FinalDayScheduleUpdate

router = APIRouter()


def get_final_day_service(db: Session = Depends(get_db)) -> FinalDayService:
    return FinalDayService(db)


@router.post(
    "/tournaments/{id}/final-day-schedule/generate",
    response_model=List[MatchResponse],
    summary="最終日スケジュール自動生成",
    description="予選リーグの結果に基づいて決勝トーナメントおよび研修試合の組み合わせを自動生成します。"
)
async def generate_final_day_schedule(
    id: int,
    background_tasks: BackgroundTasks,
    service: FinalDayService = Depends(get_final_day_service)
):
    """
    最終日日程生成

    - 既存の最終日（決勝T、研修試合）の予定は削除されます
    - 予選リーグ全試合が完了している必要があります
    """
    try:
        matches = service.generate_schedule(id)
        return matches
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("最終日スケジュール生成中にエラー発生")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"スケジュールの生成中にエラーが発生しました: {str(e)}"
        )


@router.post(
    "/matches/generate-final-day/{tournament_id}",
    response_model=List[MatchResponse],
    summary="最終日スケジュール自動生成（別名）",
)
async def generate_final_day_schedule_alt(
    tournament_id: int,
    service: FinalDayService = Depends(get_final_day_service)
):
    """
    最終日日程生成（フロントエンド互換用エンドポイント）
    """
    try:
        matches = service.generate_schedule(tournament_id)
        return matches
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("最終日スケジュール生成中にエラー発生")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"スケジュールの生成中にエラーが発生しました: {str(e)}"
        )


@router.put(
    "/matches/update-finals-bracket/{tournament_id}",
    summary="準決勝結果を決勝・3位決定戦に反映",
)
async def update_finals_bracket(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    """
    準決勝の結果に基づいて決勝・3位決定戦のチームを設定
    """
    from ..models.match import Match, MatchStage, MatchStatus

    # 準決勝を取得
    semifinals = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage == MatchStage.semifinal,
    ).order_by(Match.match_order).all()

    if len(semifinals) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="準決勝が2試合登録されていません"
        )

    # 全準決勝が完了しているか確認
    for sf in semifinals:
        if sf.status != MatchStatus.completed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="準決勝がまだ完了していません"
            )

    # 勝者・敗者を決定
    def get_winner_loser(match):
        h_total = match.home_score_total or 0
        a_total = match.away_score_total or 0
        h_pk = match.home_pk or 0
        a_pk = match.away_pk or 0

        if h_total > a_total or (h_total == a_total and h_pk > a_pk):
            return match.home_team_id, match.away_team_id
        else:
            return match.away_team_id, match.home_team_id

    sf1_winner, sf1_loser = get_winner_loser(semifinals[0])
    sf2_winner, sf2_loser = get_winner_loser(semifinals[1])

    # 決勝を更新
    final = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage == MatchStage.final,
    ).first()

    if final:
        final.home_team_id = sf1_winner
        final.away_team_id = sf2_winner

    # 3位決定戦を更新
    third_place = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage == MatchStage.third_place,
    ).first()

    if third_place:
        third_place.home_team_id = sf1_loser
        third_place.away_team_id = sf2_loser

    db.commit()

    return {
        "message": "準決勝結果を反映しました",
        "final": {
            "home_team_id": sf1_winner,
            "away_team_id": sf2_winner,
        } if final else None,
        "third_place": {
            "home_team_id": sf1_loser,
            "away_team_id": sf2_loser,
        } if third_place else None,
    }


@router.get(
    "/tournaments/{tournament_id}/final-day-schedule",
    response_model=List[MatchResponse],
    summary="最終日スケジュール取得",
    description="最終日のスケジュール（決勝トーナメント、研修試合）を取得します。"
)
async def get_final_day_schedule(
    tournament_id: int,
    db: Session = Depends(get_db)
):
    """
    最終日スケジュール取得

    - 準決勝（semifinal）
    - 3位決定戦（third_place）
    - 決勝（final）
    - 研修試合（training）

    を含む最終日の全試合を取得します。
    """
    # 最終日ステージの試合を取得
    final_stages = [
        MatchStage.semifinal,
        MatchStage.third_place,
        MatchStage.final,
        MatchStage.training
    ]

    matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage.in_(final_stages)
    ).order_by(Match.match_date, Match.match_time, Match.stage).all()

    return matches


@router.put(
    "/tournaments/{tournament_id}/final-day-schedule",
    response_model=List[MatchResponse],
    summary="最終日スケジュール一括更新",
    description="最終日スケジュールの時刻や会場を一括で更新します。"
)
async def update_final_day_schedule(
    tournament_id: int,
    schedule_update: FinalDayScheduleUpdate,
    db: Session = Depends(get_db)
):
    """
    最終日スケジュール一括更新

    - 主に時刻や会場の調整に使用
    - 指定された試合IDのみ更新されます
    """
    # 更新対象の試合IDを収集
    match_ids = [m.match_id for m in schedule_update.matches]

    # 対象試合が存在するか確認
    existing_matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.id.in_(match_ids)
    ).all()

    existing_match_map = {m.id: m for m in existing_matches}

    # 存在しない試合IDがあればエラー
    missing_ids = set(match_ids) - set(existing_match_map.keys())
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"以下の試合IDが見つかりません: {list(missing_ids)}"
        )

    # 各試合を更新
    updated_matches = []
    for update_item in schedule_update.matches:
        match = existing_match_map[update_item.match_id]

        if update_item.venue_id is not None:
            match.venue_id = update_item.venue_id
        if update_item.match_date is not None:
            match.match_date = update_item.match_date
        if update_item.match_time is not None:
            match.match_time = update_item.match_time

        updated_matches.append(match)

    db.commit()

    # 更新後のデータをリフレッシュして返す
    for match in updated_matches:
        db.refresh(match)

    return updated_matches
