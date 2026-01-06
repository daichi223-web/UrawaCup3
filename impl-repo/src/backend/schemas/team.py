from pydantic import BaseModel
from typing import Optional
from models.team import TeamType


class TeamBase(BaseModel):
    tournament_id: int
    group_id: Optional[str] = None
    name: str
    short_name: Optional[str] = None
    prefecture: Optional[str] = None
    team_type: Optional[TeamType] = None
    is_host: bool = False
    group_order: Optional[int] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    group_id: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None
    prefecture: Optional[str] = None
    team_type: Optional[TeamType] = None
    is_host: Optional[bool] = None
    group_order: Optional[int] = None


class TeamResponse(TeamBase):
    id: int

    class Config:
        from_attributes = True
