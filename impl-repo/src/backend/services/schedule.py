"""
日程生成サービス

予選リーグ: 各グループ6チーム × 5試合 = 30試合/グループ → 計120試合（変則リーグで対戦除外あり）
決勝トーナメント: 準決勝2 + 3位決定戦1 + 決勝1 = 4試合
研修試合: 2〜6位チーム同士の対戦
"""

from datetime import date, time, timedelta
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session

from ..models import Match, Team, Group, ExclusionPair, Standing, MatchStage, MatchStatus


def generate_preliminary_schedule(
    db: Session,
    tournament_id: int,
    start_date: date,
    matches_per_day: int = 6,
    start_time: time = time(9, 0),
    interval_minutes: int = 65
) -> List[Match]:
    """
    予選リーグ日程を自動生成

    Args:
        db: データベースセッション
        tournament_id: 大会ID
        start_date: 開始日
        matches_per_day: 1日あたりの試合数
        start_time: 開始時刻
        interval_minutes: 試合間隔（分）

    Returns:
        生成された試合リスト
    """
    # グループごとにチームを取得
    groups = db.query(Group).filter(Group.tournament_id == tournament_id).all()

    # 対戦除外ペアを取得
    exclusions = db.query(ExclusionPair).filter(
        ExclusionPair.tournament_id == tournament_id
    ).all()
    exclusion_set = {(e.team1_id, e.team2_id) for e in exclusions}
    exclusion_set.update({(e.team2_id, e.team1_id) for e in exclusions})

    created_matches = []

    for group in groups:
        teams = db.query(Team).filter(
            Team.tournament_id == tournament_id,
            Team.group_id == group.id
        ).order_by(Team.group_order).all()

        if len(teams) < 2:
            continue

        # 総当たり対戦組み合わせを生成（除外ペアを除く）
        matchups = []
        for i, home in enumerate(teams):
            for away in teams[i + 1:]:
                if (home.id, away.id) not in exclusion_set:
                    matchups.append((home.id, away.id))

        # 日程に割り当て
        current_date = start_date
        match_count_today = 0
        current_time = start_time

        for home_id, away_id in matchups:
            match = Match(
                tournament_id=tournament_id,
                group_id=group.id,
                venue_id=group.venue_id,
                home_team_id=home_id,
                away_team_id=away_id,
                match_date=current_date,
                match_time=current_time,
                stage=MatchStage.preliminary,
                status=MatchStatus.scheduled
            )
            db.add(match)
            created_matches.append(match)

            match_count_today += 1
            if match_count_today >= matches_per_day:
                # 翌日へ
                current_date += timedelta(days=1)
                match_count_today = 0
                current_time = start_time
            else:
                # 次の試合時間
                minutes = current_time.hour * 60 + current_time.minute + interval_minutes
                current_time = time(minutes // 60, minutes % 60)

    db.commit()
    return created_matches


def generate_finals_schedule(
    db: Session,
    tournament_id: int,
    final_date: date,
    final_venue_id: int
) -> List[Match]:
    """
    決勝トーナメント日程を生成

    組み合わせ:
    - 準決勝1: A1位 vs C1位
    - 準決勝2: B1位 vs D1位
    - 3位決定戦: 準決勝敗者同士
    - 決勝: 準決勝勝者同士
    """
    # 各グループの1位を取得
    standings = db.query(Standing).filter(
        Standing.tournament_id == tournament_id,
        Standing.rank == 1
    ).all()

    group_winners = {s.group_id: s.team_id for s in standings}

    matches = []

    # 準決勝1: A1位 vs C1位 (10:00)
    if 'A' in group_winners and 'C' in group_winners:
        sf1 = Match(
            tournament_id=tournament_id,
            venue_id=final_venue_id,
            home_team_id=group_winners.get('A'),
            away_team_id=group_winners.get('C'),
            match_date=final_date,
            match_time=time(10, 0),
            stage=MatchStage.semifinal,
            status=MatchStatus.scheduled
        )
        db.add(sf1)
        matches.append(sf1)

    # 準決勝2: B1位 vs D1位 (11:30)
    if 'B' in group_winners and 'D' in group_winners:
        sf2 = Match(
            tournament_id=tournament_id,
            venue_id=final_venue_id,
            home_team_id=group_winners.get('B'),
            away_team_id=group_winners.get('D'),
            match_date=final_date,
            match_time=time(11, 30),
            stage=MatchStage.semifinal,
            status=MatchStatus.scheduled
        )
        db.add(sf2)
        matches.append(sf2)

    # 3位決定戦 (13:30) - チームはまだ未定
    third = Match(
        tournament_id=tournament_id,
        venue_id=final_venue_id,
        match_date=final_date,
        match_time=time(13, 30),
        stage=MatchStage.third_place,
        status=MatchStatus.scheduled
    )
    db.add(third)
    matches.append(third)

    # 決勝 (15:00) - チームはまだ未定
    final = Match(
        tournament_id=tournament_id,
        venue_id=final_venue_id,
        match_date=final_date,
        match_time=time(15, 0),
        stage=MatchStage.final,
        status=MatchStatus.scheduled
    )
    db.add(final)
    matches.append(final)

    db.commit()
    return matches


def generate_training_matches(
    db: Session,
    tournament_id: int,
    final_date: date
) -> List[Match]:
    """
    研修試合（2〜6位チーム同士）を生成

    ルール:
    - 同順位同士の対戦を優先
    - 予選で対戦済みのチームは避ける
    """
    # 2〜6位のチームを順位別に取得
    standings = db.query(Standing).filter(
        Standing.tournament_id == tournament_id,
        Standing.rank >= 2
    ).order_by(Standing.rank).all()

    # 順位別にグループ化
    rank_teams: Dict[int, List[int]] = {}
    for s in standings:
        if s.rank not in rank_teams:
            rank_teams[s.rank] = []
        rank_teams[s.rank].append(s.team_id)

    # 予選での対戦履歴を取得
    played_matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.stage == MatchStage.preliminary
    ).all()

    played_pairs = set()
    for m in played_matches:
        if m.home_team_id and m.away_team_id:
            played_pairs.add((m.home_team_id, m.away_team_id))
            played_pairs.add((m.away_team_id, m.home_team_id))

    # 会場を取得（決勝会場以外）
    groups = db.query(Group).filter(Group.tournament_id == tournament_id).all()
    venues = {g.id: g.venue_id for g in groups if g.venue_id}

    created_matches = []
    match_time = time(9, 0)

    for rank in sorted(rank_teams.keys()):
        teams = rank_teams[rank]
        if len(teams) < 2:
            continue

        # 対戦組み合わせ（予選未対戦を優先）
        for i, team1 in enumerate(teams):
            for team2 in teams[i + 1:]:
                if (team1, team2) not in played_pairs:
                    # 会場を割り当て（チームのグループの会場）
                    team1_standing = next((s for s in standings if s.team_id == team1), None)
                    venue_id = venues.get(team1_standing.group_id) if team1_standing else None

                    match = Match(
                        tournament_id=tournament_id,
                        venue_id=venue_id,
                        home_team_id=team1,
                        away_team_id=team2,
                        match_date=final_date,
                        match_time=match_time,
                        stage=MatchStage.training,
                        status=MatchStatus.scheduled
                    )
                    db.add(match)
                    created_matches.append(match)

                    # 次の試合時間を計算
                    minutes = match_time.hour * 60 + match_time.minute + 65

                    # 24時を超える場合は終了
                    if minutes >= 1440:
                        db.commit()
                        return created_matches

                    match_time = time(minutes // 60, minutes % 60)

    db.commit()
    return created_matches
