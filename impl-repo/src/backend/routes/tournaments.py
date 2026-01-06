"""
大会管理API
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Tournament, Group, Team, Match, MatchStatus
from ..schemas.tournament import (
    TournamentCreate,
    TournamentUpdate,
    TournamentResponse,
    TournamentListResponse,
)
from pydantic import BaseModel


class TournamentStats(BaseModel):
    """大会統計情報"""
    totalTeams: int
    totalMatches: int
    completedMatches: int
    upcomingMatches: int

router = APIRouter()


@router.get("", response_model=List[TournamentListResponse])
def get_tournaments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """大会一覧取得"""
    tournaments = db.query(Tournament).offset(skip).limit(limit).all()
    return tournaments


@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
def create_tournament(
    tournament: TournamentCreate,
    db: Session = Depends(get_db)
):
    """
    大会作成
    - グループA〜Dを自動作成
    """
    db_tournament = Tournament(**tournament.model_dump())
    db.add(db_tournament)
    db.commit()
    db.refresh(db_tournament)

    # グループA〜D自動作成
    group_names = ["A", "B", "C", "D"]
    for group_id in group_names:
        group = Group(
            id=f"{db_tournament.id}_{group_id}",  # ユニークID
            tournament_id=db_tournament.id,
            name=f"グループ{group_id}"
        )
        db.add(group)

    db.commit()
    db.refresh(db_tournament)

    return db_tournament


@router.get("/{tournament_id}/stats", response_model=TournamentStats)
def get_tournament_stats(
    tournament_id: int,
    db: Session = Depends(get_db)
):
    """大会統計情報取得"""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="大会が見つかりません"
        )

    total_teams = db.query(Team).filter(Team.tournament_id == tournament_id).count()
    total_matches = db.query(Match).filter(Match.tournament_id == tournament_id).count()
    completed_matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.status == MatchStatus.completed
    ).count()
    upcoming_matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.status == MatchStatus.scheduled
    ).count()

    return TournamentStats(
        totalTeams=total_teams,
        totalMatches=total_matches,
        completedMatches=completed_matches,
        upcomingMatches=upcoming_matches
    )


@router.get("/{tournament_id}", response_model=TournamentResponse)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db)
):
    """大会詳細取得"""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="大会が見つかりません"
        )
    return tournament


@router.put("/{tournament_id}", response_model=TournamentResponse)
def update_tournament(
    tournament_id: int,
    tournament_update: TournamentUpdate,
    db: Session = Depends(get_db)
):
    """大会全体更新（PUT）"""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="大会が見つかりません"
        )

    update_data = tournament_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tournament, field, value)

    db.commit()
    db.refresh(tournament)
    return tournament


@router.patch("/{tournament_id}", response_model=TournamentResponse)
def partial_update_tournament(
    tournament_id: int,
    tournament_update: TournamentUpdate,
    db: Session = Depends(get_db)
):
    """大会部分更新（PATCH）"""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="大会が見つかりません"
        )

    update_data = tournament_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tournament, field, value)

    db.commit()
    db.refresh(tournament)
    return tournament


@router.delete("/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db)
):
    """大会削除"""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="大会が見つかりません"
        )

    db.delete(tournament)
    db.commit()
    return None
