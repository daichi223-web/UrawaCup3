"""
公開API（認証不要）

一般公開用のエンドポイント。順位表・試合結果の閲覧。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import (
    Tournament, Team, Match, Standing, Venue, Goal,
    MatchStatus, MatchStage
)

router = APIRouter()


@router.get("/tournaments")
def get_public_tournaments(
    db: Session = Depends(get_db)
):
    """
    公開大会一覧

    アクティブな大会のみを返す。
    """
    tournaments = db.query(Tournament).order_by(Tournament.year.desc()).limit(5).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "year": t.year,
            "edition": t.edition,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
        }
        for t in tournaments
    ]


@router.get("/tournaments/{tournament_id}/standings")
def get_public_standings(
    tournament_id: int,
    group_id: Optional[str] = Query(None, description="グループID（A/B/C/D）"),
    db: Session = Depends(get_db)
):
    """
    公開順位表（F-90）

    認証不要で順位表を閲覧。グループ別または全グループ。
    """
    query = db.query(Standing).filter(Standing.tournament_id == tournament_id)

    if group_id:
        query = query.filter(Standing.group_id == group_id)

    standings = query.order_by(Standing.group_id, Standing.rank).all()

    # チーム情報を取得
    team_ids = [s.team_id for s in standings]
    teams = {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()}

    result = {}
    for s in standings:
        if s.group_id not in result:
            result[s.group_id] = []

        team = teams.get(s.team_id)
        result[s.group_id].append({
            "rank": s.rank,
            "team_id": s.team_id,
            "team_name": team.name if team else "Unknown",
            "short_name": team.short_name if team else None,
            "is_host": team.is_host if team else False,
            "played": s.played,
            "won": s.won,
            "drawn": s.drawn,
            "lost": s.lost,
            "goals_for": s.goals_for,
            "goals_against": s.goals_against,
            "goal_difference": s.goal_difference,
            "points": s.points,
        })

    return {
        "tournament_id": tournament_id,
        "groups": result,
        "last_updated": max((s.last_updated for s in standings), default=None)
    }


@router.get("/tournaments/{tournament_id}/matches")
def get_public_matches(
    tournament_id: int,
    match_date: Optional[str] = Query(None, description="試合日（YYYY-MM-DD）"),
    group_id: Optional[str] = Query(None, description="グループID"),
    stage: Optional[str] = Query(None, description="ステージ（preliminary/semifinal/final等）"),
    db: Session = Depends(get_db)
):
    """
    公開試合一覧（F-91）

    認証不要で試合結果を閲覧。日付・グループ・ステージでフィルタ可能。
    """
    query = (
        db.query(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.venue)
        )
        .filter(Match.tournament_id == tournament_id)
    )

    if match_date:
        query = query.filter(Match.match_date == match_date)
    if group_id:
        query = query.filter(Match.group_id == group_id)
    if stage:
        query = query.filter(Match.stage == stage)

    matches = query.order_by(Match.match_date, Match.match_time).all()

    return {
        "tournament_id": tournament_id,
        "matches": [
            {
                "id": m.id,
                "match_date": m.match_date.isoformat() if m.match_date else None,
                "match_time": m.match_time.strftime("%H:%M") if m.match_time else None,
                "group_id": m.group_id,
                "stage": m.stage.value if m.stage else None,
                "status": m.status.value if m.status else None,
                "venue": m.venue.name if m.venue else None,
                "home_team": {
                    "id": m.home_team.id,
                    "name": m.home_team.name,
                    "short_name": m.home_team.short_name,
                } if m.home_team else None,
                "away_team": {
                    "id": m.away_team.id,
                    "name": m.away_team.name,
                    "short_name": m.away_team.short_name,
                } if m.away_team else None,
                "home_score": m.home_score_total,
                "away_score": m.away_score_total,
                "home_score_half1": m.home_score_half1,
                "away_score_half1": m.away_score_half1,
                "home_score_half2": m.home_score_half2,
                "away_score_half2": m.away_score_half2,
                "has_penalty_shootout": m.has_penalty_shootout,
                "home_pk": m.home_pk,
                "away_pk": m.away_pk,
            }
            for m in matches
        ],
        "count": len(matches)
    }


@router.get("/tournaments/{tournament_id}/matches/{match_id}")
def get_public_match_detail(
    tournament_id: int,
    match_id: int,
    db: Session = Depends(get_db)
):
    """
    公開試合詳細

    試合詳細と得点経過を取得。
    """
    match = (
        db.query(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
            joinedload(Match.venue),
            joinedload(Match.goals).joinedload(Goal.team),
        )
        .filter(Match.id == match_id, Match.tournament_id == tournament_id)
        .first()
    )

    if not match:
        return {"error": "Match not found"}

    goals = sorted(match.goals, key=lambda g: (g.half, g.minute))

    return {
        "id": match.id,
        "match_date": match.match_date.isoformat() if match.match_date else None,
        "match_time": match.match_time.strftime("%H:%M") if match.match_time else None,
        "group_id": match.group_id,
        "stage": match.stage.value if match.stage else None,
        "status": match.status.value if match.status else None,
        "venue": match.venue.name if match.venue else None,
        "home_team": {
            "id": match.home_team.id,
            "name": match.home_team.name,
            "short_name": match.home_team.short_name,
        } if match.home_team else None,
        "away_team": {
            "id": match.away_team.id,
            "name": match.away_team.name,
            "short_name": match.away_team.short_name,
        } if match.away_team else None,
        "score": {
            "home_total": match.home_score_total,
            "away_total": match.away_score_total,
            "home_half1": match.home_score_half1,
            "away_half1": match.away_score_half1,
            "home_half2": match.home_score_half2,
            "away_half2": match.away_score_half2,
            "has_penalty_shootout": match.has_penalty_shootout,
            "home_pk": match.home_pk,
            "away_pk": match.away_pk,
        },
        "goals": [
            {
                "minute": g.minute,
                "half": g.half,
                "team": g.team.name if g.team else None,
                "scorer": g.scorer_name,
                "is_own_goal": g.is_own_goal,
                "is_penalty": g.is_penalty,
            }
            for g in goals
        ]
    }


@router.get("/tournaments/{tournament_id}/scorers")
def get_public_scorers(
    tournament_id: int,
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db)
):
    """
    公開得点ランキング

    得点者ランキングを取得。
    """
    from sqlalchemy import func

    # 得点者ごとの得点数を集計
    scorer_stats = (
        db.query(
            Goal.scorer_name,
            Goal.team_id,
            func.count(Goal.id).label("goals")
        )
        .join(Match, Goal.match_id == Match.id)
        .filter(
            Match.tournament_id == tournament_id,
            Goal.is_own_goal == False
        )
        .group_by(Goal.scorer_name, Goal.team_id)
        .order_by(func.count(Goal.id).desc())
        .limit(limit)
        .all()
    )

    # チーム情報を取得
    team_ids = list(set(s.team_id for s in scorer_stats if s.team_id))
    teams = {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()}

    return {
        "tournament_id": tournament_id,
        "scorers": [
            {
                "rank": i + 1,
                "name": s.scorer_name,
                "team": teams.get(s.team_id).name if s.team_id and teams.get(s.team_id) else None,
                "goals": s.goals,
            }
            for i, s in enumerate(scorer_stats)
        ]
    }
