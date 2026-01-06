from pydantic import BaseModel
from typing import Optional


class GroupBase(BaseModel):
    id: str
    tournament_id: int
    name: str
    venue_id: Optional[int] = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    venue_id: Optional[int] = None


class GroupResponse(GroupBase):
    class Config:
        from_attributes = True
