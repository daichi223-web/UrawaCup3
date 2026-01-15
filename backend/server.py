from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum
import sys
import os
import uuid
import random
from collections import defaultdict

# Import the generator classes
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_daily_report_pdf import DailyReportGenerator, create_sample_data as create_daily_sample
from generate_final_result_pdf import FinalResultPDFGenerator, create_sample_data as create_final_sample
from final_day_generator_v2 import FinalDayGenerator, Team, TournamentConfig

from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Urawa Cup Core API",
    description="PDF Generation, Schedule Service & New Format Tournament APIs",
    version="2.0.0"
)

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://urawa-cup.vercel.app",
        "https://urawa-cup3.vercel.app",
        "https://urawacup3.vercel.app",
        "https://urawacup3-*.vercel.app",  # Preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount current directory for static files (html, css, js)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/", summary="フロントエンド画面")
async def read_root():
    return FileResponse('index.html')

@app.get("/schedule", summary="最終日組み合わせ画面")
async def read_schedule():
    return FileResponse('final_day_schedule.html')

class ReportConfig(BaseModel):
    recipient: Optional[str] = None
    sender: Optional[str] = None
    contact: Optional[str] = None

class DailyReportRequest(BaseModel):
    day: int
    dateStr: str
    reportConfig: Optional[ReportConfig] = None
    matchData: Dict[str, Any]

class FinalResultRequest(BaseModel):
    date: str
    reportConfig: Optional[ReportConfig] = None
    ranking: list
    tournament: list
    players: list
    training: list

@app.post("/daily-report", summary="日次報告書PDF生成")
async def generate_daily_report(
    data: Dict[str, Any] = Body(..., example=create_daily_sample())
):
    try:
        generator = DailyReportGenerator()
        filename = f"daily_report_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="daily_report.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/daily-report/sample", summary="日次報告書サンプルPDF生成")
async def generate_daily_report_sample():
    try:
        data = create_daily_sample()
        generator = DailyReportGenerator()
        filename = f"sample_daily_report_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="sample_daily_report.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/final-results", summary="最終結果報告書PDF生成")
async def generate_final_results(
    data: Dict[str, Any] = Body(..., example=create_final_sample())
):
    try:
        generator = FinalResultPDFGenerator()
        filename = f"final_results_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)
        
        generator.generate(data, output_path)
        
        return FileResponse(
            path=output_path, 
            filename="final_results.pdf", 
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/final-results/sample", summary="最終結果報告書サンプルPDF生成")
async def generate_final_results_sample():
    try:
        data = create_final_sample()
        generator = FinalResultPDFGenerator()
        filename = f"sample_final_results_{uuid.uuid4()}.pdf"
        output_path = os.path.join(os.getcwd(), filename)

        generator.generate(data, output_path)

        return FileResponse(
            path=output_path,
            filename="sample_final_results.pdf",
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 日程生成API
# =============================================================================

class TeamInput(BaseModel):
    id: int
    name: str
    group: str
    rank: int
    points: int = 0
    goalDiff: int = 0
    goalsFor: int = 0

class ScheduleGenerationRequest(BaseModel):
    standings: Dict[str, List[TeamInput]]
    playedPairs: List[List[int]] = []  # [[1,2], [3,4], ...]
    config: Optional[Dict[str, Any]] = None

@app.post("/generate-schedule", summary="最終日組み合わせ生成")
async def generate_schedule(request: ScheduleGenerationRequest):
    """
    予選順位表データから最終日の組み合わせを生成

    - 決勝トーナメント: A1 vs C1, B1 vs D1
    - 研修試合: 2〜6位チームによる交流戦（各チーム2試合）
    """
    try:
        # TeamInputをTeamオブジェクトに変換
        standings: Dict[str, List[Team]] = {}
        for group, teams in request.standings.items():
            standings[group] = [
                Team(
                    team_id=t.id,
                    team_name=t.name,
                    group=t.group,
                    rank=t.rank,
                    points=t.points,
                    goal_diff=t.goalDiff,
                    goals_for=t.goalsFor,
                )
                for t in teams
            ]

        # 対戦済みペア
        played_pairs = [(p[0], p[1]) for p in request.playedPairs if len(p) >= 2]

        # 設定
        config = TournamentConfig()
        if request.config:
            if "numGroups" in request.config:
                config.num_groups = request.config["numGroups"]
            if "teamsPerGroup" in request.config:
                config.teams_per_group = request.config["teamsPerGroup"]
            if "matchesPerTeam" in request.config:
                config.matches_per_team = request.config["matchesPerTeam"]
            if "trainingVenues" in request.config:
                config.training_venues = request.config["trainingVenues"]
            if "kickoffTimes" in request.config:
                config.kickoff_times = request.config["kickoffTimes"]

        # 日程生成
        generator = FinalDayGenerator(standings, played_pairs, config)
        result = generator.generate()

        return {
            "success": True,
            "tournament": result["tournament"],
            "training": result["training"],
            "warnings": result["warnings"],
            "config": result["config"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PreliminaryScheduleRequest(BaseModel):
    """予選リーグ日程生成リクエスト"""
    teams: List[TeamInput]
    venues: List[Dict[str, Any]]  # [{id, name}, ...]
    matchDate: str
    startTime: str = "09:30"
    matchDuration: int = 15
    breakTime: int = 5

@app.post("/generate-preliminary", summary="予選リーグ日程生成")
async def generate_preliminary_schedule(request: PreliminaryScheduleRequest):
    """
    予選リーグの総当たり日程を生成

    - 各グループ内で総当たり戦を生成
    - 会場と時間を自動割り当て
    """
    try:
        # グループごとにチームを分類
        group_teams: Dict[str, List[Dict]] = {}
        for team in request.teams:
            group = team.group
            if group not in group_teams:
                group_teams[group] = []
            group_teams[group].append({
                "id": team.id,
                "name": team.name,
                "group": group,
            })

        # 総当たりペアを生成
        matches = []
        match_number = 1

        for group, teams in group_teams.items():
            for i in range(len(teams)):
                for j in range(i + 1, len(teams)):
                    matches.append({
                        "homeTeamId": teams[i]["id"],
                        "homeTeamName": teams[i]["name"],
                        "awayTeamId": teams[j]["id"],
                        "awayTeamName": teams[j]["name"],
                        "groupId": group,
                        "matchNumber": match_number,
                    })
                    match_number += 1

        # 会場と時間を割り当て
        venues = request.venues
        # 1日あたり最大8試合分のキックオフ時刻（試合時間15分 + 休憩5分 = 20分間隔）
        kickoff_times = [
            "09:00", "09:25", "09:50", "10:15", "10:40", "11:05", "11:30", "11:55",
            "12:20", "12:45", "13:10", "13:35", "14:00", "14:25", "14:50", "15:15"
        ]
        venue_slot_count = {v["id"]: 0 for v in venues}

        scheduled_matches = []
        for idx, match in enumerate(matches):
            venue_idx = idx % len(venues)
            venue = venues[venue_idx]
            slot_idx = venue_slot_count[venue["id"]]

            # 時刻が配列を超えた場合は最後の時刻+25分を繰り返す（ただし23:59まで）
            if slot_idx < len(kickoff_times):
                kickoff = kickoff_times[slot_idx]
            else:
                extra_slots = slot_idx - len(kickoff_times) + 1
                hour = 15 + (extra_slots * 25) // 60
                minute = 40 + (extra_slots * 25) % 60
                if minute >= 60:
                    hour += 1
                    minute -= 60
                hour = min(hour, 23)  # 23時を超えないように
                kickoff = f"{hour:02d}:{minute:02d}"
            venue_slot_count[venue["id"]] += 1

            scheduled_matches.append({
                **match,
                "matchDate": request.matchDate,
                "matchTime": kickoff,
                "venueId": venue["id"],
                "venueName": venue["name"],
                "stage": "preliminary",
                "status": "scheduled",
            })

        # 会場→時間順にソート
        scheduled_matches.sort(key=lambda m: (
            next((i for i, v in enumerate(venues) if v["id"] == m["venueId"]), 0),
            m["matchTime"]
        ))

        return {
            "success": True,
            "matches": scheduled_matches,
            "total": len(scheduled_matches),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# 会場配置API (venue_assignments)
# =============================================================================

class VenueAssignmentBase(BaseModel):
    """会場配置の基本データ"""
    tournament_id: int = Field(..., alias="tournamentId")
    venue_id: int = Field(..., alias="venueId")
    team_id: int = Field(..., alias="teamId")
    match_day: int = Field(..., alias="matchDay")
    slot_order: int = Field(1, alias="slotOrder")

    class Config:
        populate_by_name = True


class VenueAssignmentCreate(BaseModel):
    """会場配置作成リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    venue_id: int = Field(..., alias="venueId")
    team_id: int = Field(..., alias="teamId")
    match_day: int = Field(..., alias="matchDay")
    slot_order: int = Field(1, alias="slotOrder")

    class Config:
        populate_by_name = True


class VenueAssignmentUpdate(BaseModel):
    """会場配置更新リクエスト"""
    venue_id: Optional[int] = Field(None, alias="venueId")
    team_id: Optional[int] = Field(None, alias="teamId")
    match_day: Optional[int] = Field(None, alias="matchDay")
    slot_order: Optional[int] = Field(None, alias="slotOrder")

    class Config:
        populate_by_name = True


class VenueAssignmentBulkCreate(BaseModel):
    """会場配置一括登録リクエスト"""
    assignments: List[VenueAssignmentCreate]


class VenueAssignmentResponse(BaseModel):
    """会場配置レスポンス"""
    id: int
    tournament_id: int = Field(..., alias="tournamentId")
    venue_id: int = Field(..., alias="venueId")
    team_id: int = Field(..., alias="teamId")
    match_day: int = Field(..., alias="matchDay")
    slot_order: int = Field(..., alias="slotOrder")

    class Config:
        populate_by_name = True
        from_attributes = True


class AutoGenerateStrategy(str, Enum):
    """自動配置戦略"""
    REGION_DISPERSED = "region_dispersed"  # 地域分散（同じ地域のチームが同じ会場に集中しない）
    BALANCED = "balanced"  # バランス配置
    RANDOM = "random"  # ランダム配置


class AutoGenerateRequest(BaseModel):
    """自動配置リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    match_day: Optional[int] = Field(None, alias="matchDay")  # 指定しない場合は全日程
    strategy: AutoGenerateStrategy = AutoGenerateStrategy.REGION_DISPERSED
    teams_per_venue: int = Field(4, alias="teamsPerVenue")

    class Config:
        populate_by_name = True


# インメモリストレージ（実際の運用ではSupabaseを使用）
venue_assignments_db: Dict[int, Dict[str, Any]] = {}
venue_assignment_counter = 0


@app.get("/api/venue-assignments", summary="会場配置一覧取得")
async def get_venue_assignments(
    tournament_id: int = Query(..., alias="tournamentId"),
    match_day: Optional[int] = Query(None, alias="matchDay")
):
    """
    会場配置一覧を取得

    - tournament_id: 大会ID（必須）
    - match_day: 試合日（オプション、指定しない場合は全日程）
    """
    results = []
    for assignment_id, assignment in venue_assignments_db.items():
        if assignment["tournament_id"] != tournament_id:
            continue
        if match_day is not None and assignment["match_day"] != match_day:
            continue
        results.append({
            "id": assignment_id,
            **assignment
        })

    # venue_id, slot_order でソート
    results.sort(key=lambda x: (x["venue_id"], x["match_day"], x["slot_order"]))

    return {
        "success": True,
        "assignments": results,
        "total": len(results)
    }


@app.post("/api/venue-assignments", summary="会場配置一括登録")
async def create_venue_assignments(request: VenueAssignmentBulkCreate):
    """
    会場配置を一括登録

    既存の配置がある場合は削除してから登録
    """
    global venue_assignment_counter

    created = []
    for assignment in request.assignments:
        venue_assignment_counter += 1
        new_id = venue_assignment_counter

        venue_assignments_db[new_id] = {
            "tournament_id": assignment.tournament_id,
            "venue_id": assignment.venue_id,
            "team_id": assignment.team_id,
            "match_day": assignment.match_day,
            "slot_order": assignment.slot_order
        }

        created.append({
            "id": new_id,
            **venue_assignments_db[new_id]
        })

    return {
        "success": True,
        "created": len(created),
        "assignments": created
    }


@app.put("/api/venue-assignments/{assignment_id}", summary="会場配置更新")
async def update_venue_assignment(assignment_id: int, request: VenueAssignmentUpdate):
    """
    会場配置を更新
    """
    if assignment_id not in venue_assignments_db:
        raise HTTPException(status_code=404, detail="会場配置が見つかりません")

    assignment = venue_assignments_db[assignment_id]

    if request.venue_id is not None:
        assignment["venue_id"] = request.venue_id
    if request.team_id is not None:
        assignment["team_id"] = request.team_id
    if request.match_day is not None:
        assignment["match_day"] = request.match_day
    if request.slot_order is not None:
        assignment["slot_order"] = request.slot_order

    return {
        "success": True,
        "assignment": {
            "id": assignment_id,
            **assignment
        }
    }


@app.delete("/api/venue-assignments/{assignment_id}", summary="会場配置削除")
async def delete_venue_assignment(assignment_id: int):
    """
    会場配置を削除
    """
    if assignment_id not in venue_assignments_db:
        raise HTTPException(status_code=404, detail="会場配置が見つかりません")

    del venue_assignments_db[assignment_id]

    return {
        "success": True,
        "message": "削除しました"
    }


@app.post("/api/venue-assignments/auto-generate", summary="会場配置自動生成")
async def auto_generate_venue_assignments(request: AutoGenerateRequest):
    """
    チームを会場に自動配置

    地域分散ロジック:
    - 同じ地域のチームが同じ会場に集中しないように配置
    - 各会場にteams_per_venue数のチームを配置

    リクエストボディ:
    - tournament_id: 大会ID
    - match_day: 試合日（省略時は全日程生成）
    - strategy: 配置戦略 (region_dispersed, balanced, random)
    - teams_per_venue: 1会場あたりのチーム数（デフォルト: 4）
    """
    global venue_assignment_counter

    # このAPIはフロントエンドからSupabase経由でチーム・会場情報を取得して呼び出す想定
    # 実際のチーム・会場データはリクエストで受け取る形に拡張可能

    # サンプル実装: リクエストにチーム・会場データが含まれている場合の処理
    # 本番環境ではSupabaseクライアントを使って直接取得する

    return {
        "success": True,
        "message": "自動配置はフロントエンドからSupabase経由でチーム・会場情報を含めて呼び出してください",
        "hint": "POST /api/venue-assignments/auto-generate-with-data を使用してください"
    }


class TeamForAssignment(BaseModel):
    """配置用チームデータ"""
    id: int
    name: str
    region: Optional[str] = None
    prefecture: Optional[str] = None


class VenueForAssignment(BaseModel):
    """配置用会場データ"""
    id: int
    name: str
    max_teams: int = Field(4, alias="maxTeams")

    class Config:
        populate_by_name = True


class AutoGenerateWithDataRequest(BaseModel):
    """チーム・会場データを含む自動配置リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    teams: List[TeamForAssignment]
    venues: List[VenueForAssignment]
    match_day: int = Field(1, alias="matchDay")
    strategy: AutoGenerateStrategy = AutoGenerateStrategy.REGION_DISPERSED
    teams_per_venue: int = Field(4, alias="teamsPerVenue")

    class Config:
        populate_by_name = True


@app.post("/api/venue-assignments/auto-generate-with-data", summary="会場配置自動生成（データ込み）")
async def auto_generate_venue_assignments_with_data(request: AutoGenerateWithDataRequest):
    """
    チームを会場に自動配置（チーム・会場データ込み）

    地域分散ロジック:
    - 同じ地域のチームが同じ会場に集中しないように配置
    - 各会場にteams_per_venue数のチームを配置
    """
    global venue_assignment_counter

    teams = request.teams
    venues = request.venues
    strategy = request.strategy
    teams_per_venue = request.teams_per_venue

    if not teams:
        raise HTTPException(status_code=400, detail="チームが指定されていません")
    if not venues:
        raise HTTPException(status_code=400, detail="会場が指定されていません")

    # 既存の配置を削除
    to_delete = [
        aid for aid, a in venue_assignments_db.items()
        if a["tournament_id"] == request.tournament_id and a["match_day"] == request.match_day
    ]
    for aid in to_delete:
        del venue_assignments_db[aid]

    assignments = []

    if strategy == AutoGenerateStrategy.REGION_DISPERSED:
        # 地域分散ロジック
        # 1. チームを地域ごとにグループ化
        region_teams: Dict[str, List[TeamForAssignment]] = defaultdict(list)
        for team in teams:
            region = team.region or team.prefecture or "unknown"
            region_teams[region].append(team)

        # 2. 各地域からラウンドロビン方式でチームを取り出し、会場に配置
        venue_assignments_list: List[List[TeamForAssignment]] = [[] for _ in venues]
        regions = list(region_teams.keys())
        random.shuffle(regions)  # 地域の順番をシャッフル

        # 各地域のチームリストをシャッフル
        for region in regions:
            random.shuffle(region_teams[region])

        # 地域インデックスとチームインデックスを追跡
        region_indices = {region: 0 for region in regions}
        venue_idx = 0
        teams_placed = 0
        total_teams = len(teams)

        while teams_placed < total_teams:
            placed_this_round = False

            for region in regions:
                if region_indices[region] < len(region_teams[region]):
                    # この地域からチームを取り出す
                    team = region_teams[region][region_indices[region]]
                    region_indices[region] += 1

                    # 会場に空きがあれば配置
                    attempts = 0
                    while attempts < len(venues):
                        if len(venue_assignments_list[venue_idx]) < teams_per_venue:
                            # この会場に同じ地域のチームがいないかチェック
                            same_region_exists = any(
                                (t.region or t.prefecture or "unknown") == (team.region or team.prefecture or "unknown")
                                for t in venue_assignments_list[venue_idx]
                            )
                            if not same_region_exists or all(
                                len(va) >= teams_per_venue or
                                any((t.region or t.prefecture or "unknown") == (team.region or team.prefecture or "unknown")
                                    for t in va)
                                for va in venue_assignments_list
                            ):
                                venue_assignments_list[venue_idx].append(team)
                                teams_placed += 1
                                placed_this_round = True
                                break
                        venue_idx = (venue_idx + 1) % len(venues)
                        attempts += 1
                    else:
                        # 全会場を試しても配置できなかった場合は強制配置
                        for vi, va in enumerate(venue_assignments_list):
                            if len(va) < teams_per_venue:
                                va.append(team)
                                teams_placed += 1
                                placed_this_round = True
                                break

                    venue_idx = (venue_idx + 1) % len(venues)

            if not placed_this_round:
                break

        # 配置結果をDBに登録
        for venue_idx, venue in enumerate(venues):
            for slot_order, team in enumerate(venue_assignments_list[venue_idx], 1):
                venue_assignment_counter += 1
                new_id = venue_assignment_counter
                venue_assignments_db[new_id] = {
                    "tournament_id": request.tournament_id,
                    "venue_id": venue.id,
                    "team_id": team.id,
                    "match_day": request.match_day,
                    "slot_order": slot_order
                }
                assignments.append({
                    "id": new_id,
                    "tournament_id": request.tournament_id,
                    "venue_id": venue.id,
                    "venue_name": venue.name,
                    "team_id": team.id,
                    "team_name": team.name,
                    "match_day": request.match_day,
                    "slot_order": slot_order
                })

    elif strategy == AutoGenerateStrategy.BALANCED:
        # バランス配置: 順番に会場に配置
        team_list = list(teams)
        for idx, team in enumerate(team_list):
            venue_idx = idx // teams_per_venue
            if venue_idx >= len(venues):
                venue_idx = venue_idx % len(venues)
            slot_order = (idx % teams_per_venue) + 1

            venue_assignment_counter += 1
            new_id = venue_assignment_counter
            venue_assignments_db[new_id] = {
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "team_id": team.id,
                "match_day": request.match_day,
                "slot_order": slot_order
            }
            assignments.append({
                "id": new_id,
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "venue_name": venues[venue_idx].name,
                "team_id": team.id,
                "team_name": team.name,
                "match_day": request.match_day,
                "slot_order": slot_order
            })

    else:  # RANDOM
        # ランダム配置
        team_list = list(teams)
        random.shuffle(team_list)

        for idx, team in enumerate(team_list):
            venue_idx = idx // teams_per_venue
            if venue_idx >= len(venues):
                venue_idx = venue_idx % len(venues)
            slot_order = (idx % teams_per_venue) + 1

            venue_assignment_counter += 1
            new_id = venue_assignment_counter
            venue_assignments_db[new_id] = {
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "team_id": team.id,
                "match_day": request.match_day,
                "slot_order": slot_order
            }
            assignments.append({
                "id": new_id,
                "tournament_id": request.tournament_id,
                "venue_id": venues[venue_idx].id,
                "venue_name": venues[venue_idx].name,
                "team_id": team.id,
                "team_name": team.name,
                "match_day": request.match_day,
                "slot_order": slot_order
            })

    return {
        "success": True,
        "created": len(assignments),
        "assignments": assignments,
        "strategy": strategy.value
    }


# =============================================================================
# 順位表API (standings)
# =============================================================================

class StandingsMode(str, Enum):
    """順位表モード"""
    OVERALL = "overall"  # 全体順位表（新フォーマット）
    GROUP = "group"  # グループ別順位表（旧フォーマット）


class StandingEntry(BaseModel):
    """順位表エントリ"""
    rank: int
    team_id: int = Field(..., alias="teamId")
    team_name: str = Field(..., alias="teamName")
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = Field(0, alias="goalsFor")
    goals_against: int = Field(0, alias="goalsAgainst")
    goal_difference: int = Field(0, alias="goalDifference")
    points: int = 0
    overall_rank: Optional[int] = Field(None, alias="overallRank")
    group_id: Optional[str] = Field(None, alias="groupId")

    class Config:
        populate_by_name = True


class MatchResult(BaseModel):
    """試合結果（順位計算用）"""
    id: int
    home_team_id: int = Field(..., alias="homeTeamId")
    away_team_id: int = Field(..., alias="awayTeamId")
    home_score: int = Field(..., alias="homeScore")
    away_score: int = Field(..., alias="awayScore")
    is_b_match: bool = Field(False, alias="isBMatch")
    match_day: Optional[int] = Field(None, alias="matchDay")
    group_id: Optional[str] = Field(None, alias="groupId")
    status: str = "completed"

    class Config:
        populate_by_name = True


class CalculateStandingsRequest(BaseModel):
    """順位計算リクエスト"""
    tournament_id: int = Field(..., alias="tournamentId")
    teams: List[Dict[str, Any]]  # [{id, name, groupId}, ...]
    matches: List[MatchResult]
    use_group_system: bool = Field(True, alias="useGroupSystem")
    exclude_b_matches: bool = Field(True, alias="excludeBMatches")

    class Config:
        populate_by_name = True


@app.get("/api/standings", summary="順位表取得")
async def get_standings(
    tournament_id: int = Query(..., alias="tournamentId"),
    mode: StandingsMode = Query(StandingsMode.OVERALL),
    group_id: Optional[str] = Query(None, alias="groupId")
):
    """
    順位表を取得

    - mode=overall: 全体順位表（新フォーマット用、use_group_system=falseの場合）
    - mode=group: グループ別順位表（旧フォーマット用、group_idが必須）

    B戦（is_b_match=true）の試合は順位計算から自動的に除外されます
    """
    if mode == StandingsMode.GROUP and not group_id:
        raise HTTPException(status_code=400, detail="グループモードではgroup_idが必須です")

    # このエンドポイントはSupabaseから直接取得するか、計算APIを使用する想定
    # 以下はサンプルレスポンス
    return {
        "success": True,
        "mode": mode.value,
        "tournament_id": tournament_id,
        "group_id": group_id,
        "standings": [],
        "message": "順位表データはSupabaseから直接取得するか、POST /api/standings/calculate を使用してください"
    }


@app.post("/api/standings/calculate", summary="順位計算")
async def calculate_standings(request: CalculateStandingsRequest):
    """
    試合結果から順位表を計算

    - use_group_system=true: グループ別に順位を計算（旧フォーマット）
    - use_group_system=false: 全体で順位を計算（新フォーマット）
    - exclude_b_matches=true: B戦を順位計算から除外（デフォルト）

    タイブレーカールール:
    1. 勝ち点
    2. 得失点差
    3. 総得点
    4. 直接対決（該当する場合）
    """
    teams = request.teams
    matches = request.matches
    use_group_system = request.use_group_system
    exclude_b_matches = request.exclude_b_matches

    # チームの成績を初期化
    team_stats: Dict[int, Dict[str, Any]] = {}
    for team in teams:
        team_id = team["id"]
        team_stats[team_id] = {
            "team_id": team_id,
            "team_name": team.get("name", f"Team {team_id}"),
            "group_id": team.get("groupId") or team.get("group_id"),
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "goals_for": 0,
            "goals_against": 0,
            "goal_difference": 0,
            "points": 0,
        }

    # 試合結果を集計
    for match in matches:
        # B戦除外チェック
        if exclude_b_matches and match.is_b_match:
            continue

        # 試合が完了していない場合はスキップ
        if match.status != "completed":
            continue

        home_id = match.home_team_id
        away_id = match.away_team_id
        home_score = match.home_score
        away_score = match.away_score

        if home_id not in team_stats or away_id not in team_stats:
            continue

        # ホームチーム
        team_stats[home_id]["played"] += 1
        team_stats[home_id]["goals_for"] += home_score
        team_stats[home_id]["goals_against"] += away_score

        # アウェイチーム
        team_stats[away_id]["played"] += 1
        team_stats[away_id]["goals_for"] += away_score
        team_stats[away_id]["goals_against"] += home_score

        # 勝敗判定
        if home_score > away_score:
            team_stats[home_id]["won"] += 1
            team_stats[home_id]["points"] += 3
            team_stats[away_id]["lost"] += 1
        elif home_score < away_score:
            team_stats[away_id]["won"] += 1
            team_stats[away_id]["points"] += 3
            team_stats[home_id]["lost"] += 1
        else:
            team_stats[home_id]["drawn"] += 1
            team_stats[home_id]["points"] += 1
            team_stats[away_id]["drawn"] += 1
            team_stats[away_id]["points"] += 1

    # 得失点差を計算
    for team_id in team_stats:
        team_stats[team_id]["goal_difference"] = (
            team_stats[team_id]["goals_for"] - team_stats[team_id]["goals_against"]
        )

    # 順位をソート
    def sort_key(stat):
        return (
            -stat["points"],
            -stat["goal_difference"],
            -stat["goals_for"],
            stat["team_name"]  # 同点の場合は名前順
        )

    if use_group_system:
        # グループ別に順位付け
        group_standings: Dict[str, List[Dict]] = defaultdict(list)

        for stat in team_stats.values():
            group_id = stat["group_id"] or "unknown"
            group_standings[group_id].append(stat)

        result_standings = []
        for group_id, group_stats in group_standings.items():
            sorted_stats = sorted(group_stats, key=sort_key)
            for rank, stat in enumerate(sorted_stats, 1):
                stat["rank"] = rank
                stat["group_id"] = group_id
                result_standings.append(stat)

        # 全体順位も計算（オプション）
        all_sorted = sorted(team_stats.values(), key=sort_key)
        for overall_rank, stat in enumerate(all_sorted, 1):
            stat["overall_rank"] = overall_rank

    else:
        # 全体で順位付け（新フォーマット）
        all_sorted = sorted(team_stats.values(), key=sort_key)
        result_standings = []
        for rank, stat in enumerate(all_sorted, 1):
            stat["rank"] = rank
            stat["overall_rank"] = rank
            result_standings.append(stat)

    return {
        "success": True,
        "tournament_id": request.tournament_id,
        "use_group_system": use_group_system,
        "exclude_b_matches": exclude_b_matches,
        "standings": result_standings,
        "total": len(result_standings)
    }


# =============================================================================
# 試合API (matches) - B戦・match_dayフィルタリング対応
# =============================================================================

@app.get("/api/matches", summary="試合一覧取得")
async def get_matches(
    tournament_id: int = Query(..., alias="tournamentId"),
    match_day: Optional[int] = Query(None, alias="matchDay"),
    is_b_match: Optional[bool] = Query(None, alias="isBMatch"),
    group_id: Optional[str] = Query(None, alias="groupId"),
    stage: Optional[str] = Query(None),
    venue_id: Optional[int] = Query(None, alias="venueId"),
    exclude_b_matches: bool = Query(False, alias="excludeBMatches")
):
    """
    試合一覧を取得

    フィルタリングオプション:
    - match_day: 試合日でフィルタ（1, 2, ...）
    - is_b_match: B戦フラグでフィルタ（true/false）
    - group_id: グループIDでフィルタ
    - stage: ステージでフィルタ（preliminary, semifinal, final, training）
    - venue_id: 会場IDでフィルタ
    - exclude_b_matches: B戦を除外（デフォルト: false）

    このエンドポイントはSupabaseから直接取得することを想定しています。
    フロントエンドではSupabaseクライアントを使用してフィルタリングしてください。
    """
    # サンプルレスポンス
    return {
        "success": True,
        "tournament_id": tournament_id,
        "filters": {
            "match_day": match_day,
            "is_b_match": is_b_match,
            "group_id": group_id,
            "stage": stage,
            "venue_id": venue_id,
            "exclude_b_matches": exclude_b_matches
        },
        "matches": [],
        "message": "試合データはSupabaseから直接取得してください。このエンドポイントはフィルタリング仕様の参照用です。"
    }


class MatchFilter(BaseModel):
    """試合フィルタ"""
    tournament_id: int = Field(..., alias="tournamentId")
    match_day: Optional[int] = Field(None, alias="matchDay")
    is_b_match: Optional[bool] = Field(None, alias="isBMatch")
    group_id: Optional[str] = Field(None, alias="groupId")
    stage: Optional[str] = None
    venue_id: Optional[int] = Field(None, alias="venueId")
    exclude_b_matches: bool = Field(False, alias="excludeBMatches")

    class Config:
        populate_by_name = True


@app.post("/api/matches/filter", summary="試合フィルタリング")
async def filter_matches(
    filter_params: MatchFilter,
    matches: List[Dict[str, Any]] = Body(...)
):
    """
    試合リストをフィルタリング

    フロントエンドで取得した試合データをサーバーサイドでフィルタリングする場合に使用。
    通常はSupabaseクエリで直接フィルタリングすることを推奨。
    """
    filtered = matches

    if filter_params.match_day is not None:
        filtered = [m for m in filtered if m.get("match_day") == filter_params.match_day or m.get("matchDay") == filter_params.match_day]

    if filter_params.is_b_match is not None:
        filtered = [m for m in filtered if m.get("is_b_match") == filter_params.is_b_match or m.get("isBMatch") == filter_params.is_b_match]

    if filter_params.exclude_b_matches:
        filtered = [m for m in filtered if not (m.get("is_b_match") or m.get("isBMatch"))]

    if filter_params.group_id is not None:
        filtered = [m for m in filtered if m.get("group_id") == filter_params.group_id or m.get("groupId") == filter_params.group_id]

    if filter_params.stage is not None:
        filtered = [m for m in filtered if m.get("stage") == filter_params.stage]

    if filter_params.venue_id is not None:
        filtered = [m for m in filtered if m.get("venue_id") == filter_params.venue_id or m.get("venueId") == filter_params.venue_id]

    return {
        "success": True,
        "matches": filtered,
        "total": len(filtered),
        "filters_applied": {
            "match_day": filter_params.match_day,
            "is_b_match": filter_params.is_b_match,
            "exclude_b_matches": filter_params.exclude_b_matches,
            "group_id": filter_params.group_id,
            "stage": filter_params.stage,
            "venue_id": filter_params.venue_id
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
