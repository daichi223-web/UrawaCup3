from pydantic import BaseModel
from typing import Optional
from datetime import date


class TournamentBase(BaseModel):
    name: str
    edition: int
    year: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    match_duration: int = 50
    half_duration: int = 25
    interval_minutes: int = 15


class TournamentCreate(TournamentBase):
    pass


class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    edition: Optional[int] = None
    year: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    match_duration: Optional[int] = None
    half_duration: Optional[int] = None
    interval_minutes: Optional[int] = None


class TournamentResponse(TournamentBase):
    id: int

    class Config:
        from_attributes = True
