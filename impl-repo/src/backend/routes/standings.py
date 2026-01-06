"""
順位表API
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Standing, Team, Goal, Player
from ..schemas.standing import (
    StandingResponse,
    GroupStandings,
    ScorerRanking,
)
from ..services.standings import recalculate_standings

router = APIRouter()


@router.get("", response_model=List[StandingResponse])
def get_standings(
    tournament_id: int = Query(...),
    group_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """順位表取得"""
    query = db.query(Standing).filter(Standing.tournament_id == tournament_id)

    if group_id:
        query = query.filter(Standing.group_id == group_id)

    standings = query.order_by(Standing.group_id, Standing.rank).all()
    return standings


@router.get("/by-group", response_model=List[GroupStandings])
def get_standings_by_group(
    tournament_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """グループ別順位表取得"""
    standings = db.query(Standing).filter(
        Standing.tournament_id == tournament_id
    ).order_by(Standing.group_id, Standing.rank).all()

    # グループ別に整理
    groups = {}
    for s in standings:
        if s.group_id not in groups:
            groups[s.group_id] = []
        groups[s.group_id].append(s)

    return [
        GroupStandings(group_id=gid, standings=stds)
        for gid, stds in sorted(groups.items())
    ]


@router.post("/recalculate/{tournament_id}")
def recalculate(
    tournament_id: int,
    group_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    順位表を再計算

    5段階順位決定ルール:
    1. 勝点 (勝=3, 分=1, 負=0)
    2. 得失点差
    3. 総得点
    4. 直接対決
    5. 抽選
    """
    recalculate_standings(db, tournament_id, group_id)

    return {"message": "順位表を再計算しました", "tournament_id": tournament_id}


@router.get("/scorers", response_model=List[ScorerRanking])
def get_scorer_ranking(
    tournament_id: int = Query(...),
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db)
):
    """得点ランキング取得"""

    # 選手ごとの得点数を集計
    scorer_stats = db.query(
        Goal.player_id,
        Goal.scorer_name,
        Goal.team_id,
        func.count(Goal.id).label('goals')
    ).join(
        Team, Goal.team_id == Team.id
    ).filter(
        Team.tournament_id == tournament_id
    ).group_by(
        Goal.player_id, Goal.scorer_name, Goal.team_id
    ).order_by(
        func.count(Goal.id).desc()
    ).limit(limit).all()

    result = []
    for rank, (player_id, scorer_name, team_id, goals) in enumerate(scorer_stats, start=1):
        # チーム名取得
        team = db.query(Team).filter(Team.id == team_id).first()
        team_name = team.name if team else ""

        # 選手名取得
        if player_id:
            player = db.query(Player).filter(Player.id == player_id).first()
            player_name = player.name if player else scorer_name or "不明"
        else:
            player_name = scorer_name or "不明"

        result.append(ScorerRanking(
            rank=rank,
            player_id=player_id,
            player_name=player_name,
            team_id=team_id,
            team_name=team_name,
            goals=goals
        ))

    return result
