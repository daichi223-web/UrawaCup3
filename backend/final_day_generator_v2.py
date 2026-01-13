#!/usr/bin/env python3
"""
最終日組み合わせ自動生成ロジック v2

- 各チーム2試合
- リーグ数を設定可能（4リーグ基本）
- ダミーデータ生成機能
"""

import random
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from enum import Enum
import json


class MatchType(Enum):
    SEMIFINAL1 = "semifinal1"
    SEMIFINAL2 = "semifinal2"
    THIRD_PLACE = "third_place"
    FINAL = "final"
    TRAINING = "training"


@dataclass
class Team:
    team_id: int
    team_name: str
    group: str  # A, B, C, D, ...
    rank: int   # 1-6
    points: int
    goal_diff: int
    goals_for: int
    
    @property
    def seed(self) -> str:
        return f"{self.group}{self.rank}"


@dataclass
class Match:
    match_id: str
    match_type: MatchType
    venue: str
    kickoff: str
    home_team: Optional[Team] = None
    away_team: Optional[Team] = None
    home_seed: str = ""
    away_seed: str = ""
    referee: str = "当該"
    warning: str = ""
    
    def to_dict(self) -> dict:
        return {
            "match_id": self.match_id,
            "match_type": self.match_type.value,
            "venue": self.venue,
            "kickoff": self.kickoff,
            "home_team_id": self.home_team.team_id if self.home_team else None,
            "home_team_name": self.home_team.team_name if self.home_team else self.home_seed,
            "home_seed": self.home_seed or (self.home_team.seed if self.home_team else ""),
            "away_team_id": self.away_team.team_id if self.away_team else None,
            "away_team_name": self.away_team.team_name if self.away_team else self.away_seed,
            "away_seed": self.away_seed or (self.away_team.seed if self.away_team else ""),
            "referee": self.referee,
            "warning": self.warning,
        }


@dataclass
class TournamentConfig:
    """大会設定"""
    num_groups: int = 4                    # グループ数（A, B, C, D, ...）
    teams_per_group: int = 6               # 各グループのチーム数
    training_venues: List[str] = None      # 研修試合会場
    tournament_venue: str = "駒場スタジアム"  # 決勝T会場
    kickoff_times: List[str] = None        # キックオフ時刻一覧
    matches_per_team: int = 2              # 各チームの研修試合数
    
    def __post_init__(self):
        if self.training_venues is None:
            self.training_venues = ["浦和南高G", "市立浦和高G", "浦和学院高G", "武南高G"]
        if self.kickoff_times is None:
            self.kickoff_times = ["9:30", "10:35", "11:40", "12:45", "13:50"]
    
    @property
    def group_names(self) -> List[str]:
        """グループ名リスト（A, B, C, D, ...）"""
        return [chr(65 + i) for i in range(self.num_groups)]


class FinalDayGenerator:
    """最終日組み合わせ自動生成"""
    
    def __init__(
        self, 
        standings: Dict[str, List[Team]], 
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
            "tournament": [m.to_dict() for m in tournament_matches],
            "training": [m.to_dict() for m in training_matches],
            "warnings": self.warnings,
            "config": {
                "num_groups": self.config.num_groups,
                "teams_per_group": self.config.teams_per_group,
                "matches_per_team": self.config.matches_per_team,
            }
        }
    
    def _generate_tournament(self) -> List[Match]:
        """決勝トーナメント生成"""
        groups = self.config.group_names
        num_groups = self.config.num_groups

        matches = []

        if num_groups == 2:
            # 2グループ: 決勝のみ（A1 vs B1）
            a1 = self.standings[groups[0]][0]
            b1 = self.standings[groups[1]][0]

            matches = [
                Match(
                    match_id="final-final",
                    match_type=MatchType.FINAL,
                    venue=self.config.tournament_venue,
                    kickoff="11:00",
                    home_team=a1,
                    away_team=b1,
                    referee="派遣",
                ),
            ]

        elif num_groups == 3:
            # 3グループ: 1位3チームでリーグ戦風または最上位2チームで決勝
            # ここでは最上位2チームで決勝とする（勝点→得失点差で決定）
            first_place_teams = [self.standings[g][0] for g in groups]
            # 勝点→得失点差→得点でソート
            sorted_teams = sorted(
                first_place_teams,
                key=lambda t: (-t.points, -t.goal_diff, -t.goals_for)
            )

            matches = [
                Match(
                    match_id="final-final",
                    match_type=MatchType.FINAL,
                    venue=self.config.tournament_venue,
                    kickoff="11:00",
                    home_team=sorted_teams[0],
                    away_team=sorted_teams[1],
                    referee="派遣",
                ),
            ]
            self.warnings.append(f"ℹ️ 3グループのため、1位の上位2チームで決勝を実施")

        elif num_groups == 4:
            # 4グループ: A vs C, B vs D
            a1 = self.standings[groups[0]][0]
            b1 = self.standings[groups[1]][0]
            c1 = self.standings[groups[2]][0]
            d1 = self.standings[groups[3]][0]

            matches = [
                Match(
                    match_id="final-sf1",
                    match_type=MatchType.SEMIFINAL1,
                    venue=self.config.tournament_venue,
                    kickoff="9:30",
                    home_team=a1,
                    away_team=c1,
                    referee="派遣",
                ),
                Match(
                    match_id="final-sf2",
                    match_type=MatchType.SEMIFINAL2,
                    venue=self.config.tournament_venue,
                    kickoff="9:30",
                    home_team=b1,
                    away_team=d1,
                    referee="派遣",
                ),
                Match(
                    match_id="final-3rd",
                    match_type=MatchType.THIRD_PLACE,
                    venue=self.config.tournament_venue,
                    kickoff="12:00",
                    home_seed="SF1敗者",
                    away_seed="SF2敗者",
                    referee="派遣",
                ),
                Match(
                    match_id="final-final",
                    match_type=MatchType.FINAL,
                    venue=self.config.tournament_venue,
                    kickoff="13:30",
                    home_seed="SF1勝者",
                    away_seed="SF2勝者",
                    referee="派遣",
                ),
            ]

        elif num_groups in [5, 6]:
            # 5-6グループ: 1位の上位4チームで準決勝→決勝
            first_place_teams = [self.standings[g][0] for g in groups]
            sorted_teams = sorted(
                first_place_teams,
                key=lambda t: (-t.points, -t.goal_diff, -t.goals_for)
            )[:4]  # 上位4チーム

            matches = [
                Match(
                    match_id="final-sf1",
                    match_type=MatchType.SEMIFINAL1,
                    venue=self.config.tournament_venue,
                    kickoff="9:30",
                    home_team=sorted_teams[0],
                    away_team=sorted_teams[3],
                    referee="派遣",
                ),
                Match(
                    match_id="final-sf2",
                    match_type=MatchType.SEMIFINAL2,
                    venue=self.config.tournament_venue,
                    kickoff="9:30",
                    home_team=sorted_teams[1],
                    away_team=sorted_teams[2],
                    referee="派遣",
                ),
                Match(
                    match_id="final-3rd",
                    match_type=MatchType.THIRD_PLACE,
                    venue=self.config.tournament_venue,
                    kickoff="12:00",
                    home_seed="SF1敗者",
                    away_seed="SF2敗者",
                    referee="派遣",
                ),
                Match(
                    match_id="final-final",
                    match_type=MatchType.FINAL,
                    venue=self.config.tournament_venue,
                    kickoff="13:30",
                    home_seed="SF1勝者",
                    away_seed="SF2勝者",
                    referee="派遣",
                ),
            ]
            self.warnings.append(f"ℹ️ {num_groups}グループのため、1位の上位4チームで決勝Tを実施")

        else:
            # 7グループ以上は未対応
            self.warnings.append(f"⚠️ {num_groups}グループの決勝T生成は未実装（2-6グループに対応）")

        return matches
    
    def _generate_training(self) -> List[Match]:
        """
        研修試合生成（各チーム2試合）
        
        20チーム × 2試合 = 40試合枠
        → 40 / 2 = 20試合
        """
        # 2〜6位のチームを取得
        training_teams = []
        for group in self.config.group_names:
            for team in self.standings[group]:
                if team.rank >= 2:
                    training_teams.append(team)
        
        # 各チームの試合カウント
        match_count = {t.team_id: 0 for t in training_teams}
        
        # 全ペアを生成
        all_pairs = []
        
        # 第1ラウンド: 同順位同士（A vs C, B vs D）
        all_pairs.extend(self._create_round1_pairs(training_teams, match_count))
        
        # 第2ラウンド: 同順位同士（A vs D, B vs C）クロス
        all_pairs.extend(self._create_round2_pairs(training_teams, match_count))
        
        # 会場・時間割り当て
        matches = self._assign_venues(all_pairs)
        
        return matches
    
    def _create_round1_pairs(
        self,
        teams: List[Team],
        match_count: Dict[int, int]
    ) -> List[Tuple[Team, Team]]:
        """第1ラウンド: 同順位で異グループのペア（クロス方式）"""
        pairs = []
        groups = self.config.group_names
        num_groups = self.config.num_groups

        for rank in range(2, self.config.teams_per_group + 1):
            rank_teams = [t for t in teams if t.rank == rank]
            teams_by_group = {t.group: t for t in rank_teams}

            if num_groups == 2:
                # 2グループ: A vs B
                pair = self._try_pair(teams_by_group.get("A"), teams_by_group.get("B"), match_count)
                if pair: pairs.append(pair)
            elif num_groups == 3:
                # 3グループ: A vs B, B vs C (ラウンドロビン前半)
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("B"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("C"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
            elif num_groups == 4:
                # 4グループ: A vs C, B vs D
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("C"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("D"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
            elif num_groups == 5:
                # 5グループ: A vs C, B vs D, E vs A（循環）
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("C"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("D"), match_count)
                pair3 = self._try_pair(teams_by_group.get("E"), teams_by_group.get("A"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
                if pair3: pairs.append(pair3)
            elif num_groups == 6:
                # 6グループ: A vs D, B vs E, C vs F
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("D"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("E"), match_count)
                pair3 = self._try_pair(teams_by_group.get("C"), teams_by_group.get("F"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
                if pair3: pairs.append(pair3)

        return pairs

    def _create_round2_pairs(
        self,
        teams: List[Team],
        match_count: Dict[int, int]
    ) -> List[Tuple[Team, Team]]:
        """第2ラウンド: 同順位で異グループのペア（第1ラウンドとクロス）"""
        pairs = []
        groups = self.config.group_names
        num_groups = self.config.num_groups

        for rank in range(2, self.config.teams_per_group + 1):
            rank_teams = [t for t in teams if t.rank == rank]
            teams_by_group = {t.group: t for t in rank_teams}

            if num_groups == 2:
                # 2グループ: 第2ラウンドなし（1試合のみ）
                pass
            elif num_groups == 3:
                # 3グループ: A vs C (ラウンドロビン後半)
                pair = self._try_pair(teams_by_group.get("A"), teams_by_group.get("C"), match_count)
                if pair: pairs.append(pair)
            elif num_groups == 4:
                # 4グループ: A vs D, B vs C（第1ラウンドとクロス）
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("D"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("C"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
            elif num_groups == 5:
                # 5グループ: B vs E, C vs A, D vs E（クロス）
                pair1 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("E"), match_count)
                pair2 = self._try_pair(teams_by_group.get("C"), teams_by_group.get("E"), match_count)
                pair3 = self._try_pair(teams_by_group.get("D"), teams_by_group.get("A"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
                if pair3: pairs.append(pair3)
            elif num_groups == 6:
                # 6グループ: A vs E, B vs F, C vs D（クロス）
                pair1 = self._try_pair(teams_by_group.get("A"), teams_by_group.get("E"), match_count)
                pair2 = self._try_pair(teams_by_group.get("B"), teams_by_group.get("F"), match_count)
                pair3 = self._try_pair(teams_by_group.get("C"), teams_by_group.get("D"), match_count)
                if pair1: pairs.append(pair1)
                if pair2: pairs.append(pair2)
                if pair3: pairs.append(pair3)

        return pairs
    
    def _try_pair(
        self, 
        home: Optional[Team], 
        away: Optional[Team], 
        match_count: Dict[int, int]
    ) -> Optional[Tuple[Team, Team]]:
        """ペアを作成（対戦済みチェック付き）"""
        if not home or not away:
            return None
        
        # 試合数上限チェック
        if match_count[home.team_id] >= self.config.matches_per_team:
            return None
        if match_count[away.team_id] >= self.config.matches_per_team:
            return None
        
        match_count[home.team_id] += 1
        match_count[away.team_id] += 1
        
        return (home, away)
    
    def _assign_venues(self, pairs: List[Tuple[Team, Team]]) -> List[Match]:
        """会場と時間を均等に割り当て"""
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
                kickoff = f"{14 + (time_idx - 4)}:00"  # 延長時間
            
            warning = ""
            if self.is_played(home.team_id, away.team_id):
                warning = "⚠️ 対戦済み"
            
            match = Match(
                match_id=f"training-{i+1:03d}",
                match_type=MatchType.TRAINING,
                venue=venue,
                kickoff=kickoff,
                home_team=home,
                away_team=away,
                referee="当該",
                warning=warning,
            )
            
            venue_count[venue] += 1
            matches.append(match)
        
        # 会場→時間順にソート（時間は文字列比較でOK: "9:30" < "10:35"にならないので変換）
        def sort_key(match):
            venue_idx = venues.index(match.venue)
            # 時間を分に変換
            h, mins = match.kickoff.split(":")
            total_minutes = int(h) * 60 + int(mins)
            return (venue_idx, total_minutes)
        
        matches.sort(key=sort_key)
        
        return matches


# =============================================================================
# ダミーデータ生成
# =============================================================================

def generate_dummy_teams(config: TournamentConfig) -> Dict[str, List[Team]]:
    """ダミーチームデータを生成"""
    
    # チーム名プール
    team_names = [
        "浦和南", "市立浦和", "浦和学院", "武南", "浦和レッズ", "浦和東",
        "東海大相模", "健大高崎", "専大北上", "日本文理", "新潟西", "旭川実業",
        "富士市立", "佐野日大", "韮崎", "國學院久我山", "日大明誠", "浦和西",
        "帝京大可児", "聖和学園", "野辺地西", "磐田東", "RB大宮", "浦和",
        "明秀日立", "敬愛学園", "中央学院", "ツエーゲン金沢", "大宮U18", "県立浦和",
    ]
    
    standings = {}
    team_id = 1
    name_idx = 0
    
    for group in config.group_names:
        group_teams = []
        
        for rank in range(1, config.teams_per_group + 1):
            # ランダムな成績を生成（順位に応じて調整）
            base_points = (config.teams_per_group - rank + 1) * 2
            points = base_points + random.randint(-1, 1)
            goal_diff = (config.teams_per_group - rank) * 2 + random.randint(-2, 2)
            goals_for = 5 + random.randint(0, 5)
            
            team = Team(
                team_id=team_id,
                team_name=team_names[name_idx % len(team_names)],
                group=group,
                rank=rank,
                points=max(0, points),
                goal_diff=goal_diff,
                goals_for=goals_for,
            )
            group_teams.append(team)
            team_id += 1
            name_idx += 1
        
        standings[group] = group_teams
    
    return standings


def generate_dummy_played_pairs(standings: Dict[str, List[Team]]) -> List[Tuple[int, int]]:
    """予選の対戦済みペア（同グループ内の全組み合わせ）"""
    played_pairs = []
    
    for group_teams in standings.values():
        for i, t1 in enumerate(group_teams):
            for t2 in group_teams[i+1:]:
                played_pairs.append((t1.team_id, t2.team_id))
    
    return played_pairs


def export_dummy_data(config: TournamentConfig, filename: str = "dummy_data.json"):
    """ダミーデータをJSONエクスポート"""
    standings = generate_dummy_teams(config)
    played_pairs = generate_dummy_played_pairs(standings)
    
    data = {
        "config": {
            "num_groups": config.num_groups,
            "teams_per_group": config.teams_per_group,
        },
        "standings": {
            group: [
                {
                    "team_id": t.team_id,
                    "team_name": t.team_name,
                    "group": t.group,
                    "rank": t.rank,
                    "points": t.points,
                    "goal_diff": t.goal_diff,
                    "goals_for": t.goals_for,
                }
                for t in teams
            ]
            for group, teams in standings.items()
        },
        "played_pairs": played_pairs,
    }
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return data


# =============================================================================
# テスト実行
# =============================================================================

def main():
    print("=" * 70)
    print("最終日組み合わせ自動生成テスト（各チーム2試合）")
    print("=" * 70)
    
    # 設定
    config = TournamentConfig(
        num_groups=4,
        teams_per_group=6,
        matches_per_team=2,
    )
    
    print(f"\n【設定】")
    print(f"  グループ数: {config.num_groups}")
    print(f"  各グループのチーム数: {config.teams_per_group}")
    print(f"  各チームの研修試合数: {config.matches_per_team}")
    print(f"  総チーム数: {config.num_groups * config.teams_per_group}")
    print(f"  決勝T進出: {config.num_groups}チーム")
    print(f"  研修試合チーム数: {config.num_groups * (config.teams_per_group - 1)}")
    
    # ダミーデータ生成
    standings = generate_dummy_teams(config)
    played_pairs = generate_dummy_played_pairs(standings)
    
    print(f"\n【予選順位表】")
    for group in config.group_names:
        print(f"\n  グループ{group}:")
        for t in standings[group]:
            print(f"    {t.rank}位: {t.team_name:12} 勝点{t.points:2} 得失差{t.goal_diff:+3}")
    
    # 自動生成
    generator = FinalDayGenerator(standings, played_pairs, config)
    result = generator.generate()
    
    print(f"\n【決勝トーナメント】@ {config.tournament_venue}")
    for m in result["tournament"]:
        print(f"  {m['kickoff']} {m['match_type']:12} {m['home_team_name']:12} vs {m['away_team_name']}")
    
    print(f"\n【研修試合】{len(result['training'])}試合")
    
    # 各チームの試合数をカウント
    team_match_count = {}
    
    current_venue = None
    for m in result["training"]:
        # カウント
        if m['home_team_id']:
            team_match_count[m['home_team_name']] = team_match_count.get(m['home_team_name'], 0) + 1
        if m['away_team_id']:
            team_match_count[m['away_team_name']] = team_match_count.get(m['away_team_name'], 0) + 1
        
        # 表示
        if m["venue"] != current_venue:
            current_venue = m["venue"]
            venue_matches = [x for x in result["training"] if x["venue"] == current_venue]
            print(f"\n  ■ {current_venue}（{len(venue_matches)}試合）")
        
        warning = f" {m['warning']}" if m['warning'] else ""
        print(f"    {m['kickoff']} {m['home_team_name']:12} vs {m['away_team_name']:12} ({m['home_seed']} vs {m['away_seed']}){warning}")
    
    print(f"\n【各チームの試合数】")
    for name, count in sorted(team_match_count.items(), key=lambda x: -x[1]):
        status = "✓" if count == config.matches_per_team else "⚠️"
        print(f"  {status} {name}: {count}試合")
    
    if result["warnings"]:
        print(f"\n【警告】")
        for w in result["warnings"]:
            print(f"  {w}")
    
    # JSONエクスポート
    export_dummy_data(config, "/home/claude/dummy_tournament_data.json")
    print(f"\n【ダミーデータ出力】")
    print(f"  /home/claude/dummy_tournament_data.json")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
