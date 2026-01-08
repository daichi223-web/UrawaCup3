from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import sys
import os
import uuid

# Import the generator classes
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_daily_report_pdf import DailyReportGenerator, create_sample_data as create_daily_sample
from generate_final_result_pdf import FinalResultPDFGenerator, create_sample_data as create_final_sample
from final_day_generator_v2 import FinalDayGenerator, Team, TournamentConfig

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Urawa Cup Core API", description="PDF Generation & Schedule Service", version="1.1.0")

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://urawa-cup.vercel.app"],
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
        kickoff_times = ["09:30", "10:35", "11:40", "12:45", "13:50", "14:55"]
        venue_slot_count = {v["id"]: 0 for v in venues}

        scheduled_matches = []
        for idx, match in enumerate(matches):
            venue_idx = idx % len(venues)
            venue = venues[venue_idx]
            slot_idx = venue_slot_count[venue["id"]]

            kickoff = kickoff_times[slot_idx] if slot_idx < len(kickoff_times) else f"{14 + slot_idx}:00"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
