"""
pytest共通設定・フィクスチャ
"""

import pytest
from datetime import date, time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
sys.path.insert(0, str(__file__).replace("tests/backend/conftest.py", "src"))

from backend.database import Base
from backend.models import (
    Tournament, Group, Team, Match, Standing, Venue,
    Player, Goal, ExclusionPair, MatchStatus, MatchStage
)


@pytest.fixture(scope="function")
def db_session():
    """テスト用のインメモリSQLiteセッション"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def tournament(db_session):
    """テスト用大会"""
    t = Tournament(
        id=1,
        name="テスト浦和カップ",
        edition=44,
        year=2026,
        start_date=date(2026, 3, 25),
        end_date=date(2026, 3, 27),
        match_duration=50,
        half_duration=25,
        interval_minutes=15
    )
    db_session.add(t)
    db_session.commit()
    return t


@pytest.fixture
def venues(db_session, tournament):
    """テスト用会場（5会場）"""
    venue_data = [
        ("浦和南高G", "浦和南", False),
        ("市立浦和高G", "市浦和", False),
        ("浦和学院高G", "浦学", False),
        ("武南高G", "武南", False),
        ("駒場スタジアム", "駒場", True),
    ]
    venues = []
    for name, short_name, is_final in venue_data:
        v = Venue(
            tournament_id=tournament.id,
            name=name,
            short_name=short_name,
            is_final_venue=is_final,
            max_matches_per_day=6
        )
        db_session.add(v)
        venues.append(v)
    db_session.commit()
    return venues


@pytest.fixture
def groups(db_session, tournament, venues):
    """テスト用グループ（A-D）"""
    group_names = ["A", "B", "C", "D"]
    groups = []
    for i, name in enumerate(group_names):
        g = Group(
            id=name,
            tournament_id=tournament.id,
            name=f"グループ{name}",
            venue_id=venues[i].id
        )
        db_session.add(g)
        groups.append(g)
    db_session.commit()
    return groups


@pytest.fixture
def teams(db_session, tournament, groups):
    """テスト用チーム（24チーム、各グループ6チーム）"""
    team_names = {
        "A": ["浦和南", "チームA2", "チームA3", "チームA4", "チームA5", "チームA6"],
        "B": ["市立浦和", "チームB2", "チームB3", "チームB4", "チームB5", "チームB6"],
        "C": ["浦和学院", "チームC2", "チームC3", "チームC4", "チームC5", "チームC6"],
        "D": ["武南", "チームD2", "チームD3", "チームD4", "チームD5", "チームD6"],
    }

    teams = []
    team_id = 1
    for group in groups:
        for order, name in enumerate(team_names[group.id], start=1):
            t = Team(
                id=team_id,
                tournament_id=tournament.id,
                group_id=group.id,
                name=name,
                short_name=name[:4],
                group_order=order,
                is_host=(order == 1)
            )
            db_session.add(t)
            teams.append(t)
            team_id += 1
    db_session.commit()
    return teams


@pytest.fixture
def completed_matches(db_session, tournament, teams, venues):
    """グループAの完了済み試合（テスト用）"""
    # グループAの6チーム
    group_a_teams = [t for t in teams if t.group_id == "A"]

    # 総当たり（15試合）のうち5試合のみ作成
    matches_data = [
        # home_idx, away_idx, home_score, away_score
        (0, 1, 2, 1),  # A1 vs A2: 2-1
        (0, 2, 3, 0),  # A1 vs A3: 3-0
        (1, 2, 1, 1),  # A2 vs A3: 1-1
        (0, 3, 1, 0),  # A1 vs A4: 1-0
        (1, 3, 2, 2),  # A2 vs A4: 2-2
    ]

    matches = []
    for i, (home_idx, away_idx, home_score, away_score) in enumerate(matches_data):
        m = Match(
            tournament_id=tournament.id,
            group_id="A",
            venue_id=venues[0].id,
            home_team_id=group_a_teams[home_idx].id,
            away_team_id=group_a_teams[away_idx].id,
            match_date=date(2026, 3, 25),
            match_time=time(9 + i, 0),
            match_order=i + 1,
            stage=MatchStage.preliminary,
            status=MatchStatus.completed,
            home_score_half1=home_score // 2,
            home_score_half2=home_score - home_score // 2,
            home_score_total=home_score,
            away_score_half1=away_score // 2,
            away_score_half2=away_score - away_score // 2,
            away_score_total=away_score
        )
        db_session.add(m)
        matches.append(m)

    db_session.commit()
    return matches
