"""
Final Day Service - 最終日組み合わせ生成サービス

TASK-005: 最終日日付の動的算出（tournament.end_dateを使用）
TASK-006: 複数グループ対応の決勝T生成（2/4/8グループ対応）

参照: UrawaCup/new/src/backend/services/final_day_service.py
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from enum import Enum
from datetime import time
from sqlalchemy.orm import Session

from ..models import Match, Team, Standing, Venue, Tournament, MatchStatus


class FinalMatchType(str, Enum):
    """決勝ラウンドの試合種別"""
    QUARTERFINAL = "quarterfinal"
    SEMIFINAL = "semifinal"
    THIRD_PLACE = "third_place"
    FINAL = "final"
    TRAINING = "training"


class MatchStage(str, Enum):
    """試合ステージ"""
    PRELIMINARY = "preliminary"
    QUARTERFINAL = "quarterfinal"
    SEMIFINAL = "semifinal"
    THIRD_PLACE = "third_place"
    FINAL = "final"
    TRAINING = "training"


@dataclass
class TeamWrapper:
    """計算用チームラッパー"""
    team_id: int
    team_name: str
    group: str
    rank: int
    points: int
    goal_diff: int
    goals_for: int

    @property
    def seed(self) -> str:
        return f"{self.group}{self.rank}"


@dataclass
class MatchWrapper:
    """計算用試合ラッパー"""
    match_id: str
    match_type: FinalMatchType
    venue: str
    kickoff: str
    home_team: Optional[TeamWrapper] = None
    away_team: Optional[TeamWrapper] = None
    home_seed: str = ""
    away_seed: str = ""
    referee: str = "当該"
    warning: str = ""


@dataclass
class TournamentConfig:
    """大会設定"""
    num_groups: int = 4
    teams_per_group: int = 6
    training_venues: List[str] = None
    tournament_venue: str = "駒場スタジアム"
    kickoff_times: List[str] = None
    matches_per_team: int = 2

    def __post_init__(self):
        if self.training_venues is None:
            self.training_venues = ["浦和南高G", "市立浦和高G", "浦和学院高G", "武南高G"]
        if self.kickoff_times is None:
            self.kickoff_times = ["9:30", "10:35", "11:40", "12:45", "13:50"]

    @property
    def group_names(self) -> List[str]:
        return [chr(65 + i) for i in range(self.num_groups)]


class FinalDayLogic:
    """決勝日組み合わせ生成ロジック"""

    def __init__(
        self,
        standings: Dict[str, List[TeamWrapper]],
        played_pairs: List[Tuple[int, int]],
        config: TournamentConfig = None
    ):
        self.standings = standings
        self.played_pairs = set((min(a, b), max(a, b)) for a, b in played_pairs)
        self.config = config or TournamentConfig()
        self.warnings: List[str] = []

    def is_played(self, team1_id: int, team2_id: int) -> bool:
        pair = (min(team1_id, team2_id), max(team1_id, team2_id))
        return pair in self.played_pairs

    def generate(self) -> Dict:
        tournament_matches = self._generate_tournament()
        training_matches = self._generate_training()

        return {
            "tournament": tournament_matches,
            "training": training_matches,
            "warnings": self.warnings
        }

    def _generate_tournament(self) -> List[MatchWrapper]:
        """
        決勝トーナメント生成

        対応グループ数:
        - 2グループ: 決勝のみ（A1 vs B1）
        - 4グループ: 準決勝2試合 + 3位決定戦 + 決勝（A1vsC1, B1vsD1）
        - 8グループ: 準々決勝4試合 + 準決勝2試合 + 3位決定戦 + 決勝
        """
        groups = self.config.group_names
        matches = []
        num_groups = self.config.num_groups

        if num_groups == 2:
            # 2グループ: 決勝のみ
            a1 = self._get_first_place(groups[0])
            b1 = self._get_first_place(groups[1])

            if a1 and b1:
                matches = [
                    MatchWrapper(
                        match_id="final-final",
                        match_type=FinalMatchType.FINAL,
                        venue=self.config.tournament_venue,
                        kickoff="13:30",
                        home_team=a1,
                        away_team=b1,
                        referee="派遣",
                    ),
                ]

        elif num_groups == 4:
            # 4グループ: 準決勝 + 3位決定戦 + 決勝
            a1 = self._get_first_place(groups[0])
            b1 = self._get_first_place(groups[1])
            c1 = self._get_first_place(groups[2])
            d1 = self._get_first_place(groups[3])

            if all([a1, b1, c1, d1]):
                matches = [
                    MatchWrapper(
                        match_id="final-sf1",
                        match_type=FinalMatchType.SEMIFINAL,
                        venue=self.config.tournament_venue,
                        kickoff="9:30",
                        home_team=a1,
                        away_team=c1,
                        referee="派遣",
                    ),
                    MatchWrapper(
                        match_id="final-sf2",
                        match_type=FinalMatchType.SEMIFINAL,
                        venue=self.config.tournament_venue,
                        kickoff="9:30",
                        home_team=b1,
                        away_team=d1,
                        referee="派遣",
                    ),
                    MatchWrapper(
                        match_id="final-3rd",
                        match_type=FinalMatchType.THIRD_PLACE,
                        venue=self.config.tournament_venue,
                        kickoff="12:00",
                        home_seed="SF1敗者",
                        away_seed="SF2敗者",
                        referee="派遣",
                    ),
                    MatchWrapper(
                        match_id="final-final",
                        match_type=FinalMatchType.FINAL,
                        venue=self.config.tournament_venue,
                        kickoff="13:30",
                        home_seed="SF1勝者",
                        away_seed="SF2勝者",
                        referee="派遣",
                    ),
                ]

        elif num_groups == 8:
            # 8グループ: 準々決勝 + 準決勝 + 3位決定戦 + 決勝
            group_1st = [self._get_first_place(g) for g in groups]

            if all(group_1st):
                # 準々決勝（QF1: A1vsE1, QF2: B1vsF1, QF3: C1vsG1, QF4: D1vsH1）
                qf_pairs = [
                    (group_1st[0], group_1st[4]),  # A1 vs E1
                    (group_1st[1], group_1st[5]),  # B1 vs F1
                    (group_1st[2], group_1st[6]),  # C1 vs G1
                    (group_1st[3], group_1st[7]),  # D1 vs H1
                ]

                for i, (home, away) in enumerate(qf_pairs):
                    matches.append(MatchWrapper(
                        match_id=f"final-qf{i+1}",
                        match_type=FinalMatchType.QUARTERFINAL,
                        venue=self.config.tournament_venue,
                        kickoff=f"{9 + i}:00",
                        home_team=home,
                        away_team=away,
                        referee="派遣",
                    ))

                # 準決勝（QF1勝者 vs QF2勝者, QF3勝者 vs QF4勝者）
                matches.extend([
                    MatchWrapper(
                        match_id="final-sf1",
                        match_type=FinalMatchType.SEMIFINAL,
                        venue=self.config.tournament_venue,
                        kickoff="13:00",
                        home_seed="QF1勝者",
                        away_seed="QF2勝者",
                        referee="派遣",
                    ),
                    MatchWrapper(
                        match_id="final-sf2",
                        match_type=FinalMatchType.SEMIFINAL,
                        venue=self.config.tournament_venue,
                        kickoff="13:00",
                        home_seed="QF3勝者",
                        away_seed="QF4勝者",
                        referee="派遣",
                    ),
                ])

                # 3位決定戦 + 決勝
                matches.extend([
                    MatchWrapper(
                        match_id="final-3rd",
                        match_type=FinalMatchType.THIRD_PLACE,
                        venue=self.config.tournament_venue,
                        kickoff="15:00",
                        home_seed="SF1敗者",
                        away_seed="SF2敗者",
                        referee="派遣",
                    ),
                    MatchWrapper(
                        match_id="final-final",
                        match_type=FinalMatchType.FINAL,
                        venue=self.config.tournament_venue,
                        kickoff="16:30",
                        home_seed="SF1勝者",
                        away_seed="SF2勝者",
                        referee="派遣",
                    ),
                ])

        else:
            # 未対応のグループ数
            self.warnings.append(
                f"⚠️ {num_groups}グループの決勝T生成は未対応です。"
                f"対応グループ数: 2, 4, 8"
            )

        return matches

    def _get_first_place(self, group: str) -> Optional[TeamWrapper]:
        """グループ1位を取得"""
        if group in self.standings and self.standings[group]:
            return self.standings[group][0]
        return None

    def _generate_training(self) -> List[MatchWrapper]:
        """研修試合生成"""
        training_teams = []
        for group in self.config.group_names:
            if group not in self.standings:
                continue
            for team in self.standings[group]:
                if team.rank >= 2:
                    training_teams.append(team)

        match_count = {t.team_id: 0 for t in training_teams}
        all_pairs = []

        # Round 1
        all_pairs.extend(self._create_round1_pairs(training_teams, match_count))
        # Round 2
        all_pairs.extend(self._create_round2_pairs(training_teams, match_count))

        matches = self._assign_venues(all_pairs)
        return matches

    def _create_round1_pairs(
        self, teams: List[TeamWrapper], match_count: Dict[int, int]
    ) -> List[Tuple[TeamWrapper, TeamWrapper]]:
        pairs = []
        for rank in range(2, self.config.teams_per_group + 1):
            rank_teams = [t for t in teams if t.rank == rank]
            teams_by_group = {t.group: t for t in rank_teams}

            if self.config.num_groups == 4:
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("C"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("D"), match_count)
                if pair1:
                    pairs.append(pair1)
                if pair2:
                    pairs.append(pair2)
        return pairs

    def _create_round2_pairs(
        self, teams: List[TeamWrapper], match_count: Dict[int, int]
    ) -> List[Tuple[TeamWrapper, TeamWrapper]]:
        pairs = []
        for rank in range(2, self.config.teams_per_group + 1):
            rank_teams = [t for t in teams if t.rank == rank]
            teams_by_group = {t.group: t for t in rank_teams}

            if self.config.num_groups == 4:
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("D"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("C"), match_count)
                if pair1:
                    pairs.append(pair1)
                if pair2:
                    pairs.append(pair2)
        return pairs

    def _try_pair(
        self,
        home: Optional[TeamWrapper],
        away: Optional[TeamWrapper],
        match_count: Dict[int, int]
    ) -> Optional[Tuple[TeamWrapper, TeamWrapper]]:
        if not home or not away:
            return None
        if match_count.get(home.team_id, 0) >= self.config.matches_per_team:
            return None
        if match_count.get(away.team_id, 0) >= self.config.matches_per_team:
            return None

        match_count[home.team_id] = match_count.get(home.team_id, 0) + 1
        match_count[away.team_id] = match_count.get(away.team_id, 0) + 1
        return (home, away)

    def _assign_venues(
        self, pairs: List[Tuple[TeamWrapper, TeamWrapper]]
    ) -> List[MatchWrapper]:
        matches = []
        venues = self.config.training_venues
        num_venues = len(venues)
        venue_count = {v: 0 for v in venues}

        for i, (home, away) in enumerate(pairs):
            venue_idx = i % num_venues
            venue = venues[venue_idx]
            time_idx = venue_count[venue]

            if time_idx < len(self.config.kickoff_times):
                kickoff = self.config.kickoff_times[time_idx]
            else:
                kickoff = f"{14 + (time_idx - 4)}:00"

            warning = ""
            if self.is_played(home.team_id, away.team_id):
                warning = "⚠️ 対戦済み"

            match = MatchWrapper(
                match_id=f"training-{i+1:03d}",
                match_type=FinalMatchType.TRAINING,
                venue=venue,
                kickoff=kickoff,
                home_team=home,
                away_team=away,
                referee="当該",
                warning=warning,
            )
            venue_count[venue] += 1
            matches.append(match)

        def sort_key(m):
            venue_idx = venues.index(m.venue) if m.venue in venues else 999
            h, mins = m.kickoff.split(":")
            total_minutes = int(h) * 60 + int(mins)
            return (venue_idx, total_minutes)

        matches.sort(key=sort_key)
        return matches


class FinalDayService:
    """最終日サービス"""

    def __init__(self, db: Session):
        self.db = db

    def generate_schedule(self, tournament_id: int) -> List[Match]:
        """
        最終日スケジュールを生成

        TASK-005: tournament.end_date を最終日日付として使用
        TASK-006: 2/4/8グループに対応
        """
        # 大会情報を取得
        tournament = self.db.query(Tournament).filter(Tournament.id == tournament_id).first()
        if not tournament:
            raise ValueError(f"Tournament with id {tournament_id} not found")

        # TASK-005: tournament.end_date を最終日日付として使用
        final_day_date = tournament.end_date
        if not final_day_date:
            raise ValueError("Tournament end_date is not set")

        # グループ数を動的に取得
        groups_query = self.db.query(Team.group_id).filter(
            Team.tournament_id == tournament_id,
            Team.group_id.isnot(None)
        ).distinct().all()
        groups = sorted([g[0] for g in groups_query])

        if not groups:
            raise ValueError("No groups found for tournament")

        # 設定を作成
        config = TournamentConfig(num_groups=len(groups))

        # 各グループの順位表を取得
        standings_map: Dict[str, List[TeamWrapper]] = {}

        for group in groups:
            standings = self.db.query(Standing).filter(
                Standing.tournament_id == tournament_id,
                Standing.group_id == group
            ).order_by(Standing.rank).all()

            wrapper_list = []
            for s in standings:
                team = self.db.query(Team).filter(Team.id == s.team_id).first()
                if team:
                    wrapper_list.append(TeamWrapper(
                        team_id=s.team_id,
                        team_name=team.name,
                        group=s.group_id,
                        rank=s.rank,
                        points=s.points,
                        goal_diff=s.goal_difference,
                        goals_for=s.goals_for
                    ))
            standings_map[group] = wrapper_list

        # 対戦済みペア取得 (予選リーグ全試合)
        matches = self.db.query(Match).filter(
            Match.tournament_id == tournament_id,
            Match.status == MatchStatus.completed
        ).all()

        played_pairs = [(m.home_team_id, m.away_team_id) for m in matches]

        # ロジック実行
        logic = FinalDayLogic(standings_map, played_pairs, config)
        result = logic.generate()

        # 既存の最終日関連試合を削除
        final_stages = ['semifinal', 'third_place', 'final', 'training', 'quarterfinal']
        self.db.query(Match).filter(
            Match.tournament_id == tournament_id,
            Match.stage.in_(final_stages)
        ).delete(synchronize_session=False)

        # 会場マップを作成
        venue_map = {
            v.name: v.id
            for v in self.db.query(Venue).filter(Venue.tournament_id == tournament_id).all()
        }

        # 試合を生成
        generated_matches = []
        match_order_map = {}

        stage_map = {
            FinalMatchType.QUARTERFINAL: 'quarterfinal',
            FinalMatchType.SEMIFINAL: 'semifinal',
            FinalMatchType.THIRD_PLACE: 'third_place',
            FinalMatchType.FINAL: 'final',
            FinalMatchType.TRAINING: 'training',
        }

        all_wrappers = result['tournament'] + result['training']

        for m in all_wrappers:
            venue_id = venue_map.get(m.venue)
            if not venue_id:
                # 会場が見つからない場合はスキップ（警告）
                continue

            match_order = match_order_map.get(venue_id, 0) + 1
            match_order_map[venue_id] = match_order

            # kickoff時刻をパース
            h, mins = m.kickoff.split(":")
            match_time = time(int(h), int(mins))

            db_match = Match(
                tournament_id=tournament_id,
                group_id=None,
                venue_id=venue_id,
                home_team_id=m.home_team.team_id if m.home_team else None,
                away_team_id=m.away_team.team_id if m.away_team else None,
                match_date=final_day_date,
                match_time=match_time,
                match_order=match_order,
                stage=stage_map.get(m.match_type, 'training'),
                status=MatchStatus.scheduled,
                home_seed=m.home_seed or (m.home_team.seed if m.home_team else ""),
                away_seed=m.away_seed or (m.away_team.seed if m.away_team else ""),
                notes=m.warning
            )
            self.db.add(db_match)
            generated_matches.append(db_match)

        self.db.commit()

        return generated_matches

    def get_warnings(self, tournament_id: int) -> List[str]:
        """生成時の警告を取得"""
        # 実際の警告は generate_schedule 実行時に発生
        # ここでは事前チェック用
        warnings = []

        groups_query = self.db.query(Team.group_id).filter(
            Team.tournament_id == tournament_id,
            Team.group_id.isnot(None)
        ).distinct().all()
        num_groups = len(groups_query)

        if num_groups not in [2, 4, 8]:
            warnings.append(
                f"⚠️ {num_groups}グループは決勝T生成に未対応です。対応: 2, 4, 8グループ"
            )

        tournament = self.db.query(Tournament).filter(Tournament.id == tournament_id).first()
        if tournament and not tournament.end_date:
            warnings.append("⚠️ 大会終了日が設定されていません")

        return warnings
