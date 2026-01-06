from pydantic import BaseModel
from typing import Optional
from datetime import date, time
from models.match import MatchStage, MatchStatus


class MatchBase(BaseModel):
    tournament_id: int
    group_id: Optional[str] = None
    venue_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None
    stage: Optional[MatchStage] = None
    status: MatchStatus = MatchStatus.scheduled


class MatchCreate(MatchBase):
    pass


class MatchUpdate(BaseModel):
    group_id: Optional[str] = None
    venue_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    match_date: Optional[date] = None
    match_time: Optional[time] = None
    stage: Optional[MatchStage] = None
    status: Optional[MatchStatus] = None
    home_score_half1: Optional[int] = None
    home_score_half2: Optional[int] = None
    home_score_total: Optional[int] = None
    away_score_half1: Optional[int] = None
    away_score_half2: Optional[int] = None
    away_score_total: Optional[int] = None


class MatchResponse(MatchBase):
    id: int
    home_score_half1: Optional[int] = None
    home_score_half2: Optional[int] = None
    home_score_total: Optional[int] = None
    away_score_half1: Optional[int] = None
    away_score_half2: Optional[int] = None
    away_score_total: Optional[int] = None

    class Config:
        from_attributes = True
