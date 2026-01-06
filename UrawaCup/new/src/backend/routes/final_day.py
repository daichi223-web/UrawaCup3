"""
Final Day Routes - 最終日関連のエンドポイント
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from services.final_day_service import FinalDayService
from schemas.match import MatchResponse

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
    - 予選リーグ全試合が完了している必要があります（警告のみで続行可能とするか要検討）
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
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"スケジュールの生成中にエラーが発生しました: {str(e)}"
        )
