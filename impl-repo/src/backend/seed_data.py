"""
ダミーデータ投入スクリプト
最終日日程生成テスト用に全試合完了済みデータを作成
"""

import sys
import os
import random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, time
from backend.database import SessionLocal, engine, Base
from backend.models import (
    Tournament, Group, Team, TeamType, Match, MatchStage, MatchStatus,
    Standing, Player, Venue, Goal, ApprovalStatus
)

# 再現性のための固定シード
random.seed(42)

def seed_data():
    db = SessionLocal()

    try:
        # 既存データクリア
        db.query(Goal).delete()
        db.query(Standing).delete()
        db.query(Match).delete()
        db.query(Player).delete()
        db.query(Team).delete()
        db.query(Venue).delete()
        db.query(Group).delete()
        db.query(Tournament).delete()
        db.commit()

        # 大会作成
        tournament = Tournament(
            name="浦和カップ 2026",
            edition=50,
            year=2026,
            start_date=date(2026, 3, 20),
            end_date=date(2026, 3, 22),
            match_duration=50,
            half_duration=25,
            interval_minutes=15,
        )
        db.add(tournament)
        db.commit()
        db.refresh(tournament)
        print(f"大会作成: {tournament.name} (ID: {tournament.id})")

        # グループ作成
        groups = {}
        for g in ["A", "B", "C", "D"]:
            group = Group(
                id=f"{tournament.id}_{g}",
                tournament_id=tournament.id,
                name=f"グループ{g}"
            )
            db.add(group)
            groups[g] = group
        db.commit()
        print("グループA〜D作成完了")

        # 会場作成
        venues_data = [
            ("浦和南高校グラウンド", "埼玉県さいたま市南区"),
            ("市立浦和高校グラウンド", "埼玉県さいたま市浦和区"),
            ("浦和学院高校グラウンド", "埼玉県さいたま市緑区"),
            ("武南高校グラウンド", "埼玉県川口市"),
            ("駒場スタジアム", "埼玉県さいたま市浦和区"),
        ]
        venues = []
        for name, addr in venues_data:
            venue = Venue(
                tournament_id=tournament.id,
                name=name,
                address=addr,
                max_matches_per_day=6,
                is_final_venue=(name == "駒場スタジアム"),
            )
            db.add(venue)
            venues.append(venue)
        db.commit()
        print(f"会場{len(venues)}件作成完了")

        # チーム作成 (各グループ6チーム = 24チーム)
        teams_data = {
            "A": [
                ("浦和南高校", "浦和南", "埼玉県", True),
                ("市立船橋高校", "市船", "千葉県", False),
                ("前橋育英高校", "前育", "群馬県", False),
                ("青森山田高校", "青山", "青森県", False),
                ("帝京高校", "帝京", "東京都", False),
                ("國學院久我山高校", "久我山", "東京都", False),
            ],
            "B": [
                ("市立浦和高校", "市浦和", "埼玉県", True),
                ("流通経済大柏高校", "流経柏", "千葉県", False),
                ("桐生第一高校", "桐一", "群馬県", False),
                ("仙台育英高校", "仙育", "宮城県", False),
                ("東福岡高校", "東福岡", "福岡県", False),
                ("大津高校", "大津", "熊本県", False),
            ],
            "C": [
                ("浦和学院高校", "浦学", "埼玉県", True),
                ("柏レイソルU-18", "柏U18", "千葉県", False),
                ("矢板中央高校", "矢板", "栃木県", False),
                ("尚志高校", "尚志", "福島県", False),
                ("静岡学園高校", "静学", "静岡県", False),
                ("藤枝東高校", "藤東", "静岡県", False),
            ],
            "D": [
                ("武南高校", "武南", "埼玉県", True),
                ("昌平高校", "昌平", "埼玉県", False),
                ("正智深谷高校", "正智", "埼玉県", False),
                ("西武台高校", "西武台", "埼玉県", False),
                ("浦和東高校", "浦東", "埼玉県", False),
                ("大宮東高校", "大宮東", "埼玉県", False),
            ],
        }

        all_teams = {}
        for group_name, team_list in teams_data.items():
            for name, short_name, pref, is_local in team_list:
                team = Team(
                    tournament_id=tournament.id,
                    group_id=f"{tournament.id}_{group_name}",
                    name=name,
                    short_name=short_name,
                    prefecture=pref,
                    team_type=TeamType.local if is_local else TeamType.invited,
                    is_host=is_local,
                )
                db.add(team)
                all_teams[f"{group_name}_{short_name}"] = team
        db.commit()
        print(f"チーム{len(all_teams)}件作成完了")

        # チームIDを再取得
        db_teams = db.query(Team).filter(Team.tournament_id == tournament.id).all()
        team_by_group = {}
        for t in db_teams:
            g = t.group_id.split("_")[1]
            if g not in team_by_group:
                team_by_group[g] = []
            team_by_group[g].append(t)

        # 選手作成 (各チーム18名)
        player_names = [
            "山田太郎", "佐藤健一", "鈴木翔太", "田中大輝", "渡辺和也",
            "高橋勇気", "伊藤慎一", "中村拓也", "小林誠", "加藤雄介",
            "山本優", "斎藤颯", "松本陸", "井上凌", "木村涼",
            "林翼", "清水駿", "前田将",
        ]
        positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW",
                     "GK", "DF", "MF", "MF", "FW", "DF", "MF"]

        all_players = {}  # team_id -> [player objects]
        for team in db_teams:
            team_players = []
            for idx, pname in enumerate(player_names):
                player = Player(
                    team_id=team.id,
                    number=idx + 1,
                    name=f"{pname}",
                    position=positions[idx],
                    grade=random.choice([1, 2, 3]),
                    is_captain=(idx == 0),
                )
                db.add(player)
                team_players.append(player)
            all_players[team.id] = team_players
        db.commit()
        print(f"選手{len(db_teams) * 18}名作成完了")

        # 予選試合作成 (各グループ11試合×4グループ=44試合)
        # 変則リーグ: 各チーム5試合 (一部対戦しないペア)
        matches_created = 0
        all_matches = []

        for group_name in ["A", "B", "C", "D"]:
            teams = team_by_group[group_name]
            venue = venues[["A", "B", "C", "D"].index(group_name)]

            # 変則リーグ: 6チーム×5試合÷2 = 15試合のところ11試合に削減
            matchups = [
                (0, 1), (2, 3), (4, 5),  # Day 1 前半
                (0, 2), (1, 4), (3, 5),  # Day 1 後半
                (0, 3), (1, 5), (2, 4),  # Day 2 前半
                (0, 4), (1, 2),          # Day 2 後半
            ]

            for i, (h, a) in enumerate(matchups):
                match_date = date(2026, 3, 20) if i < 6 else date(2026, 3, 21)
                hour = 9 + (i % 6)

                # スコア生成 (ホームやや有利)
                h1 = random.randint(0, 3)
                h2 = random.randint(0, 2)
                a1 = random.randint(0, 2)
                a2 = random.randint(0, 2)

                match = Match(
                    tournament_id=tournament.id,
                    group_id=f"{tournament.id}_{group_name}",
                    venue_id=venue.id,
                    home_team_id=teams[h].id,
                    away_team_id=teams[a].id,
                    match_date=match_date,
                    match_time=time(hour, 0),
                    stage=MatchStage.preliminary,
                    status=MatchStatus.completed,  # 全試合完了
                    home_score_half1=h1,
                    home_score_half2=h2,
                    home_score_total=h1 + h2,
                    away_score_half1=a1,
                    away_score_half2=a2,
                    away_score_total=a1 + a2,
                    approval_status=ApprovalStatus.approved,  # 全試合承認済み
                )
                db.add(match)
                all_matches.append((match, teams[h].id, teams[a].id, h1, h2, a1, a2))
                matches_created += 1

        db.commit()
        print(f"予選試合{matches_created}件作成・完了済み")

        # 試合IDを再取得してGoal作成
        db_matches = db.query(Match).filter(
            Match.tournament_id == tournament.id,
            Match.stage == MatchStage.preliminary
        ).all()

        goals_created = 0
        for match in db_matches:
            # ホームチームのゴール
            home_players = all_players.get(match.home_team_id, [])
            away_players = all_players.get(match.away_team_id, [])

            # 前半ホームゴール
            for _ in range(match.home_score_half1 or 0):
                scorer = random.choice([p for p in home_players if p.position in ["FW", "MF"]] or home_players)
                goal = Goal(
                    match_id=match.id,
                    team_id=match.home_team_id,
                    player_id=scorer.id if scorer else None,
                    minute=random.randint(1, 25),
                    half=1,
                )
                db.add(goal)
                goals_created += 1

            # 後半ホームゴール
            for _ in range(match.home_score_half2 or 0):
                scorer = random.choice([p for p in home_players if p.position in ["FW", "MF"]] or home_players)
                goal = Goal(
                    match_id=match.id,
                    team_id=match.home_team_id,
                    player_id=scorer.id if scorer else None,
                    minute=random.randint(26, 50),
                    half=2,
                )
                db.add(goal)
                goals_created += 1

            # 前半アウェイゴール
            for _ in range(match.away_score_half1 or 0):
                scorer = random.choice([p for p in away_players if p.position in ["FW", "MF"]] or away_players)
                goal = Goal(
                    match_id=match.id,
                    team_id=match.away_team_id,
                    player_id=scorer.id if scorer else None,
                    minute=random.randint(1, 25),
                    half=1,
                )
                db.add(goal)
                goals_created += 1

            # 後半アウェイゴール
            for _ in range(match.away_score_half2 or 0):
                scorer = random.choice([p for p in away_players if p.position in ["FW", "MF"]] or away_players)
                goal = Goal(
                    match_id=match.id,
                    team_id=match.away_team_id,
                    player_id=scorer.id if scorer else None,
                    minute=random.randint(26, 50),
                    half=2,
                )
                db.add(goal)
                goals_created += 1

        db.commit()
        print(f"ゴール{goals_created}件作成完了")

        # 順位表作成
        for group_name in ["A", "B", "C", "D"]:
            teams = team_by_group[group_name]
            group_matches = db.query(Match).filter(
                Match.group_id == f"{tournament.id}_{group_name}",
                Match.status == MatchStatus.completed
            ).all()

            # チーム別成績計算
            stats = {t.id: {"w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0} for t in teams}

            for m in group_matches:
                h = m.home_team_id
                a = m.away_team_id
                hg = m.home_score_total or 0
                ag = m.away_score_total or 0

                stats[h]["gf"] += hg
                stats[h]["ga"] += ag
                stats[a]["gf"] += ag
                stats[a]["ga"] += hg

                if hg > ag:
                    stats[h]["w"] += 1
                    stats[h]["pts"] += 3
                    stats[a]["l"] += 1
                elif hg < ag:
                    stats[a]["w"] += 1
                    stats[a]["pts"] += 3
                    stats[h]["l"] += 1
                else:
                    stats[h]["d"] += 1
                    stats[a]["d"] += 1
                    stats[h]["pts"] += 1
                    stats[a]["pts"] += 1

            # 順位決定
            sorted_teams = sorted(
                teams,
                key=lambda t: (stats[t.id]["pts"], stats[t.id]["gf"] - stats[t.id]["ga"], stats[t.id]["gf"]),
                reverse=True
            )

            for rank, team in enumerate(sorted_teams, 1):
                s = stats[team.id]
                standing = Standing(
                    tournament_id=tournament.id,
                    group_id=f"{tournament.id}_{group_name}",
                    team_id=team.id,
                    rank=rank,
                    played=s["w"] + s["d"] + s["l"],
                    won=s["w"],
                    drawn=s["d"],
                    lost=s["l"],
                    goals_for=s["gf"],
                    goals_against=s["ga"],
                    goal_difference=s["gf"] - s["ga"],
                    points=s["pts"],
                )
                db.add(standing)

        db.commit()
        print("順位表作成完了")

        print("\n=== ダミーデータ投入完了 ===")
        print(f"大会: 1件")
        print(f"グループ: 4件")
        print(f"会場: 5件")
        print(f"チーム: 24件")
        print(f"選手: {len(db_teams) * 18}名")
        print(f"試合: {matches_created}件 (全試合完了・承認済み)")
        print(f"ゴール: {goals_created}件")
        print(f"順位表: 24件")
        print("\n最終日日程生成の準備完了！")

    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
