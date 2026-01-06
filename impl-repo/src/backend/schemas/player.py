from pydantic import BaseModel
from typing import Optional


class PlayerBase(BaseModel):
    team_id: int
    number: Optional[int] = None
    name: str
    name_kana: Optional[str] = None
    grade: Optional[int] = None
    position: Optional[str] = None
    is_captain: bool = False


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    team_id: Optional[int] = None
    number: Optional[int] = None
    name: Optional[str] = None
    name_kana: Optional[str] = None
    grade: Optional[int] = None
    position: Optional[str] = None
    is_captain: Optional[bool] = None


class PlayerResponse(PlayerBase):
    id: int

    class Config:
        from_attributes = True
