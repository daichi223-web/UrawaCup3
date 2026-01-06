"""
チーム管理API
"""

import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Team, TeamType, Match, Player, Goal
from ..schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    TeamListResponse,
)

router = APIRouter()


@router.get("", response_model=List[TeamListResponse])
def get_teams(
    tournament_id: Optional[int] = Query(None),
    group_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db)
):
    """チーム一覧取得"""
    query = db.query(Team)

    if tournament_id:
        query = query.filter(Team.tournament_id == tournament_id)
    if group_id:
        query = query.filter(Team.group_id == group_id)

    teams = query.order_by(Team.group_id, Team.group_order).offset(skip).limit(limit).all()
    return teams


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    team: TeamCreate,
    db: Session = Depends(get_db)
):
    """チーム作成"""
    db_team = Team(**team.model_dump())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db)
):
    """チーム詳細取得"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="チームが見つかりません"
        )
    return team


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    team_update: TeamUpdate,
    db: Session = Depends(get_db)
):
    """チーム更新"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="チームが見つかりません"
        )

    update_data = team_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db)
):
    """チーム削除"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="チームが見つかりません"
        )

    # 依存データチェック
    matches_count = db.query(Match).filter(
        (Match.home_team_id == team_id) | (Match.away_team_id == team_id)
    ).count()
    if matches_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"このチームには{matches_count}件の試合が関連付けられています。先に試合を削除してください。"
        )

    players_count = db.query(Player).filter(Player.team_id == team_id).count()
    if players_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"このチームには{players_count}人の選手が登録されています。先に選手を削除してください。"
        )

    goals_count = db.query(Goal).filter(Goal.team_id == team_id).count()
    if goals_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"このチームには{goals_count}件の得点記録があります。先に得点記録を削除してください。"
        )

    db.delete(team)
    db.commit()
    return None


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_teams_csv(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    CSVからチーム一括登録

    CSV形式:
    group_id,name,short_name,prefecture,team_type,is_host
    A,浦和南高校,浦和南,埼玉県,local,true
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSVファイルを指定してください"
        )

    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))

    created_teams = []
    for row in reader:
        team_type = TeamType.local if row.get('team_type', '').lower() == 'local' else TeamType.invited
        is_host = row.get('is_host', '').lower() in ('true', '1', 'yes')

        team = Team(
            tournament_id=tournament_id,
            group_id=row.get('group_id'),
            name=row['name'],
            short_name=row.get('short_name'),
            prefecture=row.get('prefecture'),
            team_type=team_type,
            is_host=is_host
        )
        db.add(team)
        created_teams.append(team)

    db.commit()

    return {"message": f"{len(created_teams)}件のチームをインポートしました"}
