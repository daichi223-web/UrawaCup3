"""
スタッフ管理API
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Staff, Team
from ..schemas.staff import StaffCreate, StaffUpdate, StaffResponse

router = APIRouter()


@router.get("", response_model=List[StaffResponse])
def get_staff(
    team_id: Optional[int] = Query(None),
    tournament_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """スタッフ一覧取得"""
    query = db.query(Staff)
    if team_id:
        query = query.filter(Staff.team_id == team_id)
    if tournament_id:
        query = query.join(Team).filter(Team.tournament_id == tournament_id)
    return query.all()


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(staff: StaffCreate, db: Session = Depends(get_db)):
    """スタッフ作成"""
    db_staff = Staff(**staff.model_dump())
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return db_staff


@router.get("/{staff_id}", response_model=StaffResponse)
def get_staff_member(staff_id: int, db: Session = Depends(get_db)):
    """スタッフ詳細取得"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    return staff


@router.put("/{staff_id}", response_model=StaffResponse)
def update_staff(staff_id: int, staff_update: StaffUpdate, db: Session = Depends(get_db)):
    """スタッフ更新"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")

    for field, value in staff_update.model_dump(exclude_unset=True).items():
        setattr(staff, field, value)

    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    """スタッフ削除"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")
    db.delete(staff)
    db.commit()
