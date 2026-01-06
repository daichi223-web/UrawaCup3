"""
試合APIのテスト

- CRUD操作
- スコア入力
- ロック機能
- 承認フロー
- 状態遷移
"""

import pytest
from datetime import date, time, datetime, timezone, timedelta
from fastapi.testclient import TestClient

import sys
sys.path.insert(0, str(__file__).replace("tests/backend/test_matches_api.py", "src"))

from backend.main import app
from backend.database import get_db
from backend.models import Match, MatchLock, MatchStatus, MatchStage, ApprovalStatus


@pytest.fixture
def client(db_session):
    """テスト用HTTPクライアント"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestMatchStatusTransition:
    """試合ステータス遷移のテスト"""

    def test_allowed_transitions(self):
        """許可される状態遷移"""
        from backend.models import MatchStatus

        # scheduled -> in_progress: OK
        assert MatchStatus.can_transition(MatchStatus.scheduled, MatchStatus.in_progress)

        # scheduled -> cancelled: OK
        assert MatchStatus.can_transition(MatchStatus.scheduled, MatchStatus.cancelled)

        # in_progress -> completed: OK
        assert MatchStatus.can_transition(MatchStatus.in_progress, MatchStatus.completed)

        # cancelled -> scheduled: OK (再開)
        assert MatchStatus.can_transition(MatchStatus.cancelled, MatchStatus.scheduled)

    def test_disallowed_transitions(self):
        """禁止される状態遷移"""
        from backend.models import MatchStatus

        # scheduled -> completed: NG (in_progressを経由する必要あり)
        assert not MatchStatus.can_transition(MatchStatus.scheduled, MatchStatus.completed)

        # completed -> scheduled: NG
        assert not MatchStatus.can_transition(MatchStatus.completed, MatchStatus.scheduled)

    def test_same_status_allowed(self):
        """同じステータスへの遷移は許可"""
        from backend.models import MatchStatus

        assert MatchStatus.can_transition(MatchStatus.scheduled, MatchStatus.scheduled)
        assert MatchStatus.can_transition(MatchStatus.completed, MatchStatus.completed)


class TestMatchLock:
    """試合ロック機能のテスト"""

    def test_lock_creation(self, db_session, tournament, teams, venues):
        """ロック作成"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.scheduled
        )
        db_session.add(match)
        db_session.commit()

        lock = MatchLock(
            match_id=match.id,
            user_id=1,
            locked_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
        )
        db_session.add(lock)
        db_session.commit()

        # ロックが作成されていること
        saved_lock = db_session.query(MatchLock).filter(MatchLock.match_id == match.id).first()
        assert saved_lock is not None
        assert saved_lock.user_id == 1

    def test_lock_expiration(self, db_session, tournament, teams, venues):
        """ロック有効期限"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.scheduled
        )
        db_session.add(match)
        db_session.commit()

        # 期限切れのロック
        expired_lock = MatchLock(
            match_id=match.id,
            user_id=1,
            locked_at=datetime.now(timezone.utc) - timedelta(minutes=10),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=5)
        )
        db_session.add(expired_lock)
        db_session.commit()

        # 期限切れ判定
        assert expired_lock.expires_at < datetime.now(timezone.utc)


class TestApprovalFlow:
    """承認フローのテスト"""

    def test_initial_approval_status(self, db_session, tournament, teams, venues):
        """初期承認ステータス"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.scheduled
        )
        db_session.add(match)
        db_session.commit()

        assert match.approval_status == ApprovalStatus.pending

    def test_approval_status_after_score_input(self, db_session, tournament, teams, venues):
        """スコア入力後の承認ステータス"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.scheduled
        )
        db_session.add(match)
        db_session.commit()

        # スコア入力
        match.home_score_total = 2
        match.away_score_total = 1
        match.status = MatchStatus.completed
        match.approval_status = ApprovalStatus.pending
        db_session.commit()

        assert match.status == MatchStatus.completed
        assert match.approval_status == ApprovalStatus.pending

    def test_approval_sets_approved_status(self, db_session, tournament, teams, venues):
        """承認処理"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.completed,
            approval_status=ApprovalStatus.pending,
            home_score_total=2,
            away_score_total=1
        )
        db_session.add(match)
        db_session.commit()

        # 承認
        match.approval_status = ApprovalStatus.approved
        match.approved_by = 1
        match.approved_at = datetime.now(timezone.utc)
        db_session.commit()

        assert match.approval_status == ApprovalStatus.approved
        assert match.approved_by == 1

    def test_rejection_sets_rejected_status(self, db_session, tournament, teams, venues):
        """却下処理"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.completed,
            approval_status=ApprovalStatus.pending,
            home_score_total=2,
            away_score_total=1
        )
        db_session.add(match)
        db_session.commit()

        # 却下
        match.approval_status = ApprovalStatus.rejected
        match.approved_by = 1
        match.approved_at = datetime.now(timezone.utc)
        match.rejection_reason = "スコアに誤りがあります"
        db_session.commit()

        assert match.approval_status == ApprovalStatus.rejected
        assert match.rejection_reason == "スコアに誤りがあります"


class TestScoreCalculation:
    """スコア計算のテスト"""

    def test_total_score_calculation(self, db_session, tournament, teams, venues):
        """合計スコア計算"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.preliminary,
            status=MatchStatus.completed,
            home_score_half1=1,
            home_score_half2=2,
            away_score_half1=0,
            away_score_half2=1
        )

        # 合計計算
        match.home_score_total = match.home_score_half1 + match.home_score_half2
        match.away_score_total = match.away_score_half1 + match.away_score_half2

        assert match.home_score_total == 3
        assert match.away_score_total == 1

    def test_penalty_shootout(self, db_session, tournament, teams, venues):
        """PK戦"""
        match = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=teams[0].id,
            away_team_id=teams[1].id,
            match_date=date(2026, 3, 25),
            match_time=time(10, 0),
            stage=MatchStage.final,  # 決勝戦
            status=MatchStatus.completed,
            home_score_half1=1,
            home_score_half2=0,
            home_score_total=1,
            away_score_half1=0,
            away_score_half2=1,
            away_score_total=1,
            has_penalty_shootout=True,
            home_pk=4,
            away_pk=3
        )
        db_session.add(match)
        db_session.commit()

        assert match.has_penalty_shootout is True
        assert match.home_pk == 4
        assert match.away_pk == 3
