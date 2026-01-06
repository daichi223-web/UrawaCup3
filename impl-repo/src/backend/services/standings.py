"""
順位表計算サービス

5段階順位決定ルール:
1. 勝点 (勝=3, 分=1, 負=0)
2. 得失点差
3. 総得点
4. 直接対決
5. 抽選（決定的ハッシュベース - SHA256）

TASK-004: 抽選ロジック改善、rank_reason追加
"""

import hashlib
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session

from ..models import Match, Team, Standing, MatchStatus


def recalculate_standings(db: Session, tournament_id: int, group_id: str = None):
    """
    順位表を再計算

    Args:
        db: データベースセッション
        tournament_id: 大会ID
        group_id: グループID（Noneの場合は全グループ）
    """
    if group_id:
        groups = [group_id]
    else:
        # 全グループを取得
        teams = db.query(Team.group_id).filter(
            Team.tournament_id == tournament_id,
            Team.group_id.isnot(None)
        ).distinct().all()
        groups = [t[0] for t in teams]

    for gid in groups:
        _calculate_group_standings(db, tournament_id, gid)


def _calculate_group_standings(db: Session, tournament_id: int, group_id: str):
    """グループ内の順位を計算"""

    # グループ内のチームを取得
    teams = db.query(Team).filter(
        Team.tournament_id == tournament_id,
        Team.group_id == group_id
    ).all()

    if not teams:
        return

    # 完了済み試合を取得
    matches = db.query(Match).filter(
        Match.tournament_id == tournament_id,
        Match.group_id == group_id,
        Match.status == MatchStatus.completed
    ).all()

    # チームごとの成績を集計
    stats: Dict[int, Dict] = {}
    for team in teams:
        stats[team.id] = {
            'team_id': team.id,
            'played': 0,
            'won': 0,
            'drawn': 0,
            'lost': 0,
            'goals_for': 0,
            'goals_against': 0,
            'points': 0,
        }

    # 試合結果を集計
    for match in matches:
        if match.home_team_id not in stats or match.away_team_id not in stats:
            continue

        home_stats = stats[match.home_team_id]
        away_stats = stats[match.away_team_id]

        # 試合数
        home_stats['played'] += 1
        away_stats['played'] += 1

        # 得点
        home_score = match.home_score_total or 0
        away_score = match.away_score_total or 0
        home_stats['goals_for'] += home_score
        home_stats['goals_against'] += away_score
        away_stats['goals_for'] += away_score
        away_stats['goals_against'] += home_score

        # 勝敗
        if home_score > away_score:
            home_stats['won'] += 1
            home_stats['points'] += 3
            away_stats['lost'] += 1
        elif home_score < away_score:
            away_stats['won'] += 1
            away_stats['points'] += 3
            home_stats['lost'] += 1
        else:
            home_stats['drawn'] += 1
            away_stats['drawn'] += 1
            home_stats['points'] += 1
            away_stats['points'] += 1

    # 得失点差を計算
    for team_id, s in stats.items():
        s['goal_difference'] = s['goals_for'] - s['goals_against']

    # 直接対決マップを作成
    head_to_head = _build_head_to_head(matches)

    # ソート（5段階ルール）+ rank_reason追跡
    team_ids = list(stats.keys())
    sorted_teams, rank_reasons = _sort_teams_with_reasons(
        team_ids, stats, head_to_head, tournament_id, group_id
    )

    # 順位表を更新
    for rank, team_id in enumerate(sorted_teams, start=1):
        s = stats[team_id]

        # 既存のStandingを取得または作成
        standing = db.query(Standing).filter(
            Standing.tournament_id == tournament_id,
            Standing.team_id == team_id
        ).first()

        if not standing:
            standing = Standing(
                tournament_id=tournament_id,
                group_id=group_id,
                team_id=team_id
            )
            db.add(standing)

        standing.rank = rank
        standing.rank_reason = rank_reasons.get(team_id)
        standing.played = s['played']
        standing.won = s['won']
        standing.drawn = s['drawn']
        standing.lost = s['lost']
        standing.goals_for = s['goals_for']
        standing.goals_against = s['goals_against']
        standing.goal_difference = s['goal_difference']
        standing.points = s['points']

    db.commit()


def _build_head_to_head(matches: List[Match]) -> Dict[Tuple[int, int], Dict]:
    """
    直接対決の結果マップを作成

    Returns:
        {(team1_id, team2_id): {'wins': x, 'draws': y, 'losses': z, 'gf': a, 'ga': b}}
    """
    h2h: Dict[Tuple[int, int], Dict] = {}

    for match in matches:
        home_id = match.home_team_id
        away_id = match.away_team_id
        home_goals = match.home_score_total or 0
        away_goals = match.away_score_total or 0

        # 双方向で記録
        for t1, t2, g1, g2 in [(home_id, away_id, home_goals, away_goals),
                                 (away_id, home_id, away_goals, home_goals)]:
            key = (t1, t2)
            if key not in h2h:
                h2h[key] = {"wins": 0, "draws": 0, "losses": 0, "gf": 0, "ga": 0}

            h2h[key]["gf"] += g1
            h2h[key]["ga"] += g2

            if g1 > g2:
                h2h[key]["wins"] += 1
            elif g1 < g2:
                h2h[key]["losses"] += 1
            else:
                h2h[key]["draws"] += 1

    return h2h


def _get_lottery_score(tournament_id: int, team_id: int, tied_team_ids: List[int]) -> int:
    """
    決定的抽選スコアを取得（SHA256ベース）

    同じ大会・同じ同順位グループに対して常に同じ順序を返す

    Args:
        tournament_id: 大会ID
        team_id: 対象チームID
        tied_team_ids: 同順位のチームIDリスト

    Returns:
        抽選スコア（小さい方が上位）
    """
    sorted_ids = sorted(tied_team_ids)
    seed_string = f"{tournament_id}:{','.join(map(str, sorted_ids))}:{team_id}"
    hash_bytes = hashlib.sha256(seed_string.encode()).digest()
    return int.from_bytes(hash_bytes[:8], 'big')


def _sort_teams_with_reasons(
    team_ids: List[int],
    stats: Dict[int, Dict],
    head_to_head: Dict[Tuple[int, int], Dict],
    tournament_id: int,
    group_id: str
) -> Tuple[List[int], Dict[int, Optional[str]]]:
    """
    5段階ルールでチームをソートし、順位決定理由を返す

    Returns:
        (sorted_team_ids, {team_id: rank_reason})
    """
    rank_reasons: Dict[int, Optional[str]] = {}

    def base_key(team_id: int):
        s = stats[team_id]
        return (
            -s['points'],           # 1. 勝点（降順）
            -s['goal_difference'],  # 2. 得失点差（降順）
            -s['goals_for'],        # 3. 総得点（降順）
        )

    # 基本ソート
    sorted_ids = sorted(team_ids, key=base_key)

    # 同成績チームを見つけて直接対決・抽選で順位決定
    i = 0
    while i < len(sorted_ids):
        # 同じ成績のチームを集める
        j = i + 1
        while j < len(sorted_ids) and base_key(sorted_ids[j]) == base_key(sorted_ids[i]):
            j += 1

        tied_count = j - i

        if tied_count == 1:
            # 単独順位：理由なし
            rank_reasons[sorted_ids[i]] = None
        else:
            # 同成績のチームがいる場合
            tied_teams = sorted_ids[i:j]
            resolved_teams, reasons = _resolve_tied_teams(
                tied_teams, head_to_head, tournament_id
            )
            sorted_ids[i:j] = resolved_teams
            rank_reasons.update(reasons)

        i = j

    return sorted_ids, rank_reasons


def _resolve_tied_teams(
    team_ids: List[int],
    head_to_head: Dict[Tuple[int, int], Dict],
    tournament_id: int
) -> Tuple[List[int], Dict[int, str]]:
    """
    同成績チームを直接対決→抽選で順位決定

    Returns:
        (sorted_team_ids, {team_id: reason})
    """
    reasons: Dict[int, str] = {}

    if len(team_ids) == 2:
        # 2チームの場合：直接対決で判定
        t1, t2 = team_ids
        key = (t1, t2)

        if key in head_to_head:
            h2h = head_to_head[key]
            if h2h["wins"] > h2h["losses"]:
                reasons[t1] = "直接対決で上位"
                reasons[t2] = "直接対決で下位"
                return [t1, t2], reasons
            elif h2h["wins"] < h2h["losses"]:
                reasons[t1] = "直接対決で下位"
                reasons[t2] = "直接対決で上位"
                return [t2, t1], reasons
            else:
                # 直接対決も引き分け→得失点差
                t1_diff = h2h["gf"] - h2h["ga"]
                t2_diff = head_to_head[(t2, t1)]["gf"] - head_to_head[(t2, t1)]["ga"]
                if t1_diff > t2_diff:
                    reasons[t1] = "直接対決の得失点差で上位"
                    reasons[t2] = "直接対決の得失点差で下位"
                    return [t1, t2], reasons
                elif t1_diff < t2_diff:
                    reasons[t1] = "直接対決の得失点差で下位"
                    reasons[t2] = "直接対決の得失点差で上位"
                    return [t2, t1], reasons

    # 3チーム以上、または直接対決で決着がつかない場合：抽選
    sorted_teams = sorted(
        team_ids,
        key=lambda t: _get_lottery_score(tournament_id, t, team_ids)
    )

    for team_id in sorted_teams:
        reasons[team_id] = "抽選により決定"

    return sorted_teams, reasons
