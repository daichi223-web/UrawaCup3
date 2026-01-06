"""
選手管理API
"""

import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Player, Team
from ..schemas.player import (
    PlayerCreate,
    PlayerUpdate,
    PlayerResponse,
    PlayerListResponse,
    PlayerSuggest,
)
from ..services.player_import_service import (
    UrawaCupExcelParser,
    create_players_from_parse_result,
    create_staff_from_parse_result,
    create_uniforms_from_parse_result,
)

router = APIRouter()


@router.get("", response_model=List[PlayerListResponse])
def get_players(
    team_id: Optional[int] = Query(None),
    tournament_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, description="名前または背番号で検索"),
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db)
):
    """選手一覧取得"""
    query = db.query(Player)

    if team_id:
        query = query.filter(Player.team_id == team_id)

    if tournament_id:
        query = query.join(Team).filter(Team.tournament_id == tournament_id)

    if search:
        # 名前または背番号で検索
        if search.isdigit():
            query = query.filter(Player.number == int(search))
        else:
            query = query.filter(Player.name.contains(search))

    players = query.order_by(Player.number).offset(skip).limit(limit).all()
    return players


@router.post("", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(
    player: PlayerCreate,
    db: Session = Depends(get_db)
):
    """選手作成"""
    # 同一チーム内の背番号重複チェック
    if player.number is not None:
        existing = db.query(Player).filter(
            Player.team_id == player.team_id,
            Player.number == player.number
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"背番号 {player.number} は既に使用されています"
            )

    db_player = Player(**player.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


@router.get("/suggest", response_model=List[PlayerSuggest])
def suggest_players(
    team_id: int = Query(...),
    query: str = Query("", description="検索クエリ"),
    db: Session = Depends(get_db)
):
    """
    得点者サジェスト機能
    チームIDと検索クエリから候補を返す
    """
    players_query = db.query(Player).filter(Player.team_id == team_id)

    if query:
        if query.isdigit():
            players_query = players_query.filter(Player.number == int(query))
        else:
            players_query = players_query.filter(
                Player.name.contains(query) | Player.name_kana.contains(query)
            )

    players = players_query.limit(10).all()

    # チーム名を取得
    team = db.query(Team).filter(Team.id == team_id).first()
    team_name = team.name if team else ""

    return [
        PlayerSuggest(
            id=p.id,
            number=p.number,
            name=p.name,
            team_id=p.team_id,
            team_name=team_name
        )
        for p in players
    ]


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(
    player_id: int,
    db: Session = Depends(get_db)
):
    """選手詳細取得"""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="選手が見つかりません"
        )
    return player


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(
    player_id: int,
    player_update: PlayerUpdate,
    db: Session = Depends(get_db)
):
    """選手更新"""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="選手が見つかりません"
        )

    update_data = player_update.model_dump(exclude_unset=True)

    # 背番号を変更する場合のみ重複チェック
    if 'number' in update_data and update_data['number'] is not None:
        new_number = update_data['number']
        # 自分自身は除外してチェック
        if new_number != player.number:
            existing = db.query(Player).filter(
                Player.team_id == player.team_id,
                Player.number == new_number,
                Player.id != player_id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"背番号 {new_number} は既に使用されています"
                )

    for field, value in update_data.items():
        setattr(player, field, value)

    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db)
):
    """選手削除"""
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="選手が見つかりません"
        )

    db.delete(player)
    db.commit()
    return None


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_players_csv(
    team_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    CSV/Excelから選手一括登録

    CSV形式:
    number,name,name_kana,grade,position,is_captain
    10,山田太郎,ヤマダタロウ,3,FW,true
    """
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSVファイルを指定してください"
        )

    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))

    created_players = []
    for row in reader:
        is_captain = row.get('is_captain', '').lower() in ('true', '1', 'yes')
        grade = int(row['grade']) if row.get('grade') else None
        number = int(row['number']) if row.get('number') else None

        player = Player(
            team_id=team_id,
            number=number,
            name=row['name'],
            name_kana=row.get('name_kana'),
            grade=grade,
            position=row.get('position'),
            is_captain=is_captain
        )
        db.add(player)
        created_players.append(player)

    db.commit()

    return {"message": f"{len(created_players)}件の選手をインポートしました"}


@router.post("/import-excel", status_code=status.HTTP_201_CREATED)
async def import_players_excel(
    team_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Excel（浦和カップ参加申込書）から選手・スタッフ・ユニフォーム一括登録

    対応ファイル形式: .xlsx
    """
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Excelファイル(.xlsx)を指定してください"
        )

    # チームの存在確認
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="チームが見つかりません"
        )

    # ファイル読み込み
    content = await file.read()

    # パース
    parser = UrawaCupExcelParser()
    parse_result = parser.parse(content, file.filename)

    # パースエラーチェック
    if parse_result.errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Excelファイルのパースに失敗しました",
                "errors": parse_result.errors
            }
        )

    # 選手データ作成
    players, player_errors = create_players_from_parse_result(parse_result, team_id)
    for player in players:
        db.add(player)

    # スタッフデータ作成
    staff_list, staff_errors = create_staff_from_parse_result(parse_result, team_id)
    for staff in staff_list:
        db.add(staff)

    # ユニフォームデータ作成
    uniforms, uniform_errors = create_uniforms_from_parse_result(parse_result, team_id)
    for uniform in uniforms:
        db.add(uniform)

    db.commit()

    # 結果サマリー
    all_errors = player_errors + staff_errors + uniform_errors

    return {
        "message": "インポートが完了しました",
        "format": parse_result.format,
        "team_info": {
            "name": parse_result.team_info.name if parse_result.team_info else None,
        },
        "imported": {
            "players": len(players),
            "staff": len(staff_list),
            "uniforms": len(uniforms),
        },
        "errors": all_errors,
        "warnings": parse_result.warnings,
    }
