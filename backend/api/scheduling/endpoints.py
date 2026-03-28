from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import sys
import os

# Import the generator classes
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from final_day_generator_v2 import FinalDayGenerator, Team, TournamentConfig

router = APIRouter()

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

@router.post("/generate-schedule", summary="最終日組み合わせ生成")
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
            if "bracketMethod" in request.config:
                config.bracket_method = request.config["bracketMethod"]

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

@router.post("/generate-preliminary", summary="予選リーグ日程生成")
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
