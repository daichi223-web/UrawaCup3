"""
最終日組み合わせ生成サービスのテスト

- 決勝トーナメント生成（2/4/8グループ対応）
- 研修試合生成
- 対戦済み警告
"""

import pytest
from datetime import date

import sys
sys.path.insert(0, str(__file__).replace("tests/backend/test_final_day.py", "src"))

from backend.services.final_day import (
    FinalDayLogic,
    FinalDayService,
    TournamentConfig,
    TeamWrapper,
    FinalMatchType,
)
from backend.models import Match, Standing, MatchStatus, MatchStage


class TestTournamentConfig:
    """大会設定のテスト"""

    def test_default_config(self):
        """デフォルト設定が正しいこと"""
        config = TournamentConfig()
        assert config.num_groups == 4
        assert config.teams_per_group == 6
        assert len(config.training_venues) == 4
        assert config.tournament_venue == "駒場スタジアム"

    def test_group_names_generation(self):
        """グループ名が正しく生成されること"""
        config4 = TournamentConfig(num_groups=4)
        assert config4.group_names == ["A", "B", "C", "D"]

        config8 = TournamentConfig(num_groups=8)
        assert config8.group_names == ["A", "B", "C", "D", "E", "F", "G", "H"]

        config2 = TournamentConfig(num_groups=2)
        assert config2.group_names == ["A", "B"]


class TestFinalDayLogic:
    """決勝日ロジックのテスト"""

    @pytest.fixture
    def sample_standings(self):
        """サンプル順位データ"""
        return {
            "A": [
                TeamWrapper(team_id=1, team_name="A1位", group="A", rank=1, points=15, goal_diff=10, goals_for=15),
                TeamWrapper(team_id=2, team_name="A2位", group="A", rank=2, points=12, goal_diff=5, goals_for=10),
                TeamWrapper(team_id=3, team_name="A3位", group="A", rank=3, points=9, goal_diff=2, goals_for=8),
            ],
            "B": [
                TeamWrapper(team_id=11, team_name="B1位", group="B", rank=1, points=15, goal_diff=8, goals_for=12),
                TeamWrapper(team_id=12, team_name="B2位", group="B", rank=2, points=10, goal_diff=3, goals_for=7),
                TeamWrapper(team_id=13, team_name="B3位", group="B", rank=3, points=7, goal_diff=0, goals_for=5),
            ],
            "C": [
                TeamWrapper(team_id=21, team_name="C1位", group="C", rank=1, points=14, goal_diff=7, goals_for=11),
                TeamWrapper(team_id=22, team_name="C2位", group="C", rank=2, points=11, goal_diff=4, goals_for=9),
                TeamWrapper(team_id=23, team_name="C3位", group="C", rank=3, points=8, goal_diff=1, goals_for=6),
            ],
            "D": [
                TeamWrapper(team_id=31, team_name="D1位", group="D", rank=1, points=13, goal_diff=6, goals_for=10),
                TeamWrapper(team_id=32, team_name="D2位", group="D", rank=2, points=9, goal_diff=2, goals_for=6),
                TeamWrapper(team_id=33, team_name="D3位", group="D", rank=3, points=6, goal_diff=-1, goals_for=4),
            ],
        }

    def test_4_groups_tournament_generation(self, sample_standings):
        """4グループの決勝トーナメント生成"""
        config = TournamentConfig(num_groups=4)
        logic = FinalDayLogic(sample_standings, [], config)
        result = logic.generate()

        tournament_matches = result["tournament"]

        # 準決勝2試合 + 3位決定戦 + 決勝 = 4試合
        assert len(tournament_matches) == 4

        # 準決勝1: A1 vs C1
        sf1 = next(m for m in tournament_matches if m.match_id == "final-sf1")
        assert sf1.home_team.team_name == "A1位"
        assert sf1.away_team.team_name == "C1位"
        assert sf1.match_type == FinalMatchType.SEMIFINAL

        # 準決勝2: B1 vs D1
        sf2 = next(m for m in tournament_matches if m.match_id == "final-sf2")
        assert sf2.home_team.team_name == "B1位"
        assert sf2.away_team.team_name == "D1位"

    def test_2_groups_tournament_generation(self):
        """2グループの決勝トーナメント生成（決勝のみ）"""
        standings = {
            "A": [TeamWrapper(team_id=1, team_name="A1位", group="A", rank=1, points=15, goal_diff=10, goals_for=15)],
            "B": [TeamWrapper(team_id=11, team_name="B1位", group="B", rank=1, points=15, goal_diff=8, goals_for=12)],
        }
        config = TournamentConfig(num_groups=2)
        logic = FinalDayLogic(standings, [], config)
        result = logic.generate()

        tournament_matches = result["tournament"]

        # 決勝のみ = 1試合
        assert len(tournament_matches) == 1
        assert tournament_matches[0].match_type == FinalMatchType.FINAL
        assert tournament_matches[0].home_team.team_name == "A1位"
        assert tournament_matches[0].away_team.team_name == "B1位"

    def test_training_matches_generation(self, sample_standings):
        """研修試合の生成"""
        config = TournamentConfig(num_groups=4)
        logic = FinalDayLogic(sample_standings, [], config)
        result = logic.generate()

        training_matches = result["training"]

        # 研修試合が生成されていること
        assert len(training_matches) > 0

        # すべて研修試合タイプであること
        for m in training_matches:
            assert m.match_type == FinalMatchType.TRAINING

    def test_played_pairs_warning(self, sample_standings):
        """対戦済みチームの警告"""
        # A2位(id=2) と C2位(id=22) が対戦済み
        played_pairs = [(2, 22)]

        config = TournamentConfig(num_groups=4)
        logic = FinalDayLogic(sample_standings, played_pairs, config)

        assert logic.is_played(2, 22) is True
        assert logic.is_played(22, 2) is True  # 逆順でも検出
        assert logic.is_played(2, 12) is False

    def test_unsupported_group_count_warning(self):
        """未対応グループ数の警告"""
        standings = {chr(65 + i): [] for i in range(5)}  # 5グループ
        config = TournamentConfig(num_groups=5)
        logic = FinalDayLogic(standings, [], config)
        result = logic.generate()

        assert len(result["warnings"]) > 0
        assert "5グループ" in result["warnings"][0]


class TestFinalDayService:
    """FinalDayServiceのテスト"""

    def test_generate_schedule(self, db_session, tournament, teams, venues, groups):
        """最終日スケジュール生成"""
        # 順位表を作成
        for i, group_id in enumerate(["A", "B", "C", "D"]):
            group_teams = [t for t in teams if t.group_id == group_id]
            for rank, team in enumerate(group_teams, start=1):
                standing = Standing(
                    tournament_id=tournament.id,
                    group_id=group_id,
                    team_id=team.id,
                    rank=rank,
                    played=5,
                    won=5 - rank,
                    drawn=0,
                    lost=rank - 1,
                    goals_for=15 - rank * 2,
                    goals_against=rank * 2,
                    goal_difference=15 - rank * 4,
                    points=(5 - rank) * 3
                )
                db_session.add(standing)
        db_session.commit()

        # サービス実行
        service = FinalDayService(db_session)
        matches = service.generate_schedule(tournament.id)

        # 試合が生成されていること
        assert len(matches) > 0

        # 最終日の日付が使用されていること
        for m in matches:
            assert m.match_date == tournament.end_date

    def test_get_warnings_for_unsupported_groups(self, db_session, tournament, teams):
        """未対応グループ数の警告取得"""
        # 5グループ目のチームを追加（テスト用）
        from backend.models import Team
        extra_team = Team(
            tournament_id=tournament.id,
            group_id="E",
            name="Extra Team",
            group_order=1
        )
        db_session.add(extra_team)
        db_session.commit()

        service = FinalDayService(db_session)
        warnings = service.get_warnings(tournament.id)

        assert len(warnings) > 0


class TestTeamWrapper:
    """TeamWrapperのテスト"""

    def test_seed_property(self):
        """シード文字列が正しく生成されること"""
        team = TeamWrapper(
            team_id=1,
            team_name="Test",
            group="A",
            rank=1,
            points=10,
            goal_diff=5,
            goals_for=10
        )
        assert team.seed == "A1"

        team2 = TeamWrapper(
            team_id=2,
            team_name="Test2",
            group="C",
            rank=3,
            points=5,
            goal_diff=0,
            goals_for=5
        )
        assert team2.seed == "C3"
