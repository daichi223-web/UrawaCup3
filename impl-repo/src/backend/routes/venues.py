"""
会場管理API
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Venue
from ..schemas.venue import VenueCreate, VenueUpdate, VenueResponse

router = APIRouter()


@router.get("", response_model=List[VenueResponse])
def get_venues(
    tournament_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """会場一覧取得"""
    query = db.query(Venue)
    if tournament_id:
        query = query.filter(Venue.tournament_id == tournament_id)
    return query.all()


@router.post("", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
def create_venue(venue: VenueCreate, db: Session = Depends(get_db)):
    """会場作成"""
    db_venue = Venue(**venue.model_dump())
    db.add(db_venue)
    db.commit()
    db.refresh(db_venue)
    return db_venue


@router.get("/{venue_id}", response_model=VenueResponse)
def get_venue(venue_id: int, db: Session = Depends(get_db)):
    """会場詳細取得"""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="会場が見つかりません")
    return venue


@router.put("/{venue_id}", response_model=VenueResponse)
def update_venue(venue_id: int, venue_update: VenueUpdate, db: Session = Depends(get_db)):
    """会場更新"""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="会場が見つかりません")

    for field, value in venue_update.model_dump(exclude_unset=True).items():
        setattr(venue, field, value)

    db.commit()
    db.refresh(venue)
    return venue


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(venue_id: int, db: Session = Depends(get_db)):
    """会場削除"""
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="会場が見つかりません")
    db.delete(venue)
    db.commit()
