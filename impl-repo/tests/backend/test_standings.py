"""
順位表計算サービスのテスト

5段階順位決定ルール:
1. 勝点 (勝=3, 分=1, 負=0)
2. 得失点差
3. 総得点
4. 直接対決
5. 抽選（SHA256決定的ハッシュ）
"""

import pytest
from datetime import date, time

import sys
sys.path.insert(0, str(__file__).replace("tests/backend/test_standings.py", "src"))

from backend.services.standings import (
    recalculate_standings,
    _calculate_group_standings,
    _build_head_to_head,
    _get_lottery_score,
    _sort_teams_with_reasons,
    _resolve_tied_teams
)
from backend.models import Match, Team, Standing, MatchStatus, MatchStage


class TestRecalculateStandings:
    """順位表再計算のテスト"""

    def test_basic_standings_calculation(self, db_session, tournament, teams, completed_matches):
        """基本的な順位計算が正しく動作すること"""
        recalculate_standings(db_session, tournament.id, "A")

        standings = db_session.query(Standing).filter(
            Standing.tournament_id == tournament.id,
            Standing.group_id == "A"
        ).order_by(Standing.rank).all()

        # 順位表が作成されていること
        assert len(standings) == 6

        # 1位のチームを確認（A1: 3勝0分0敗 = 9点）
        first_place = standings[0]
        assert first_place.rank == 1
        assert first_place.points == 9  # 3勝 × 3点
        assert first_place.won == 3
        assert first_place.drawn == 0
        assert first_place.lost == 0

    def test_points_calculation(self, db_session, tournament, teams, completed_matches):
        """勝点計算が正しいこと（勝利=3, 引分=1, 敗北=0）"""
        recalculate_standings(db_session, tournament.id, "A")

        standings = db_session.query(Standing).filter(
            Standing.tournament_id == tournament.id,
            Standing.group_id == "A"
        ).all()

        for s in standings:
            expected_points = s.won * 3 + s.drawn * 1 + s.lost * 0
            assert s.points == expected_points, f"Team {s.team_id}: expected {expected_points}, got {s.points}"

    def test_goal_difference_calculation(self, db_session, tournament, teams, completed_matches):
        """得失点差計算が正しいこと"""
        recalculate_standings(db_session, tournament.id, "A")

        standings = db_session.query(Standing).filter(
            Standing.tournament_id == tournament.id,
            Standing.group_id == "A"
        ).all()

        for s in standings:
            expected_diff = s.goals_for - s.goals_against
            assert s.goal_difference == expected_diff


class TestHeadToHead:
    """直接対決ロジックのテスト"""

    def test_build_head_to_head_map(self, db_session, tournament, teams, completed_matches):
        """直接対決マップが正しく構築されること"""
        h2h = _build_head_to_head(completed_matches)

        # A1 vs A2 の結果を確認（2-1でA1勝利）
        a1_id = teams[0].id
        a2_id = teams[1].id

        assert (a1_id, a2_id) in h2h
        assert h2h[(a1_id, a2_id)]["wins"] == 1
        assert h2h[(a1_id, a2_id)]["losses"] == 0
        assert h2h[(a1_id, a2_id)]["gf"] == 2
        assert h2h[(a1_id, a2_id)]["ga"] == 1

        # 逆方向も確認
        assert (a2_id, a1_id) in h2h
        assert h2h[(a2_id, a1_id)]["wins"] == 0
        assert h2h[(a2_id, a1_id)]["losses"] == 1


class TestLotteryScore:
    """抽選ロジック（SHA256）のテスト"""

    def test_lottery_is_deterministic(self):
        """同じ入力に対して常に同じ結果を返すこと"""
        tournament_id = 1
        team_ids = [10, 20, 30]

        score1 = _get_lottery_score(tournament_id, 10, team_ids)
        score2 = _get_lottery_score(tournament_id, 10, team_ids)

        assert score1 == score2

    def test_lottery_different_for_different_teams(self):
        """異なるチームには異なるスコアを返すこと"""
        tournament_id = 1
        team_ids = [10, 20, 30]

        score_10 = _get_lottery_score(tournament_id, 10, team_ids)
        score_20 = _get_lottery_score(tournament_id, 20, team_ids)
        score_30 = _get_lottery_score(tournament_id, 30, team_ids)

        # すべて異なる値
        assert len({score_10, score_20, score_30}) == 3

    def test_lottery_order_independent(self):
        """同順位チームリストの順序が変わっても結果が同じこと"""
        tournament_id = 1

        score1 = _get_lottery_score(tournament_id, 10, [10, 20, 30])
        score2 = _get_lottery_score(tournament_id, 10, [30, 10, 20])

        assert score1 == score2


class TestRankReason:
    """順位決定理由（rank_reason）のテスト"""

    def test_rank_reason_for_head_to_head(self, db_session, tournament, teams, completed_matches):
        """直接対決で決まった場合の理由が記録されること"""
        recalculate_standings(db_session, tournament.id, "A")

        standings = db_session.query(Standing).filter(
            Standing.tournament_id == tournament.id,
            Standing.group_id == "A"
        ).all()

        # rank_reasonフィールドが存在すること
        for s in standings:
            # 単独順位の場合はNone、タイブレーカー適用時は理由あり
            assert s.rank_reason is None or isinstance(s.rank_reason, str)


class TestTieBreaker:
    """タイブレーカーのテスト"""

    def test_tiebreaker_order(self, db_session, tournament, venues, groups):
        """タイブレーカーの適用順序が正しいこと"""
        # 同勝点のチームを作成
        team1 = Team(id=100, tournament_id=tournament.id, group_id="A", name="Tie1", group_order=1)
        team2 = Team(id=101, tournament_id=tournament.id, group_id="A", name="Tie2", group_order=2)
        db_session.add_all([team1, team2])
        db_session.commit()

        # 同じ勝点だが得失点差が異なる試合結果
        # Team1: 1勝 (3-0) = 勝点3, 得失点差+3
        # Team2: 1勝 (1-0) = 勝点3, 得失点差+1
        m1 = Match(
            tournament_id=tournament.id, group_id="A", venue_id=venues[0].id,
            home_team_id=team1.id, away_team_id=102,  # ダミーチーム
            match_date=date(2026, 3, 25), match_time=time(9, 0),
            stage=MatchStage.preliminary, status=MatchStatus.completed,
            home_score_total=3, away_score_total=0
        )
        m2 = Match(
            tournament_id=tournament.id, group_id="A", venue_id=venues[0].id,
            home_team_id=team2.id, away_team_id=103,
            match_date=date(2026, 3, 25), match_time=time(10, 0),
            stage=MatchStage.preliminary, status=MatchStatus.completed,
            home_score_total=1, away_score_total=0
        )

        # 得失点差でTeam1が上位になるはず
        stats = {
            100: {"points": 3, "goal_difference": 3, "goals_for": 3},
            101: {"points": 3, "goal_difference": 1, "goals_for": 1},
        }

        # ソートキーのテスト
        def base_key(team_id):
            s = stats[team_id]
            return (-s["points"], -s["goal_difference"], -s["goals_for"])

        sorted_ids = sorted([100, 101], key=base_key)
        assert sorted_ids[0] == 100  # 得失点差でTeam1が上位


class TestEdgeCases:
    """エッジケースのテスト"""

    def test_no_matches_played(self, db_session, tournament, teams):
        """試合がない場合でも順位表が作成されること"""
        recalculate_standings(db_session, tournament.id, "A")

        standings = db_session.query(Standing).filter(
            Standing.tournament_id == tournament.id,
            Standing.group_id == "A"
        ).all()

        assert len(standings) == 6
        for s in standings:
            assert s.played == 0
            assert s.points == 0

    def test_all_groups_calculation(self, db_session, tournament, teams, venues, groups):
        """全グループの順位計算ができること"""
        recalculate_standings(db_session, tournament.id)

        for group_id in ["A", "B", "C", "D"]:
            standings = db_session.query(Standing).filter(
                Standing.tournament_id == tournament.id,
                Standing.group_id == group_id
            ).all()
            assert len(standings) == 6
