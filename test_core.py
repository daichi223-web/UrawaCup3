#!/usr/bin/env python3
"""
状態遷移オーケストレーター コア機能テスト
"""

import asyncio
from pathlib import Path
from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Dict, Any, List
from datetime import datetime

# ============================================
# 状態定義
# ============================================

class Phase(Enum):
    IMPLEMENT = auto()
    REVIEW = auto()
    ANALYZE = auto()
    EXTRACT = auto()
    ISSUE = auto()
    INVESTIGATE = auto()
    DOCUMENT = auto()
    DONE = auto()

@dataclass
class CycleState:
    phase: Phase = Phase.IMPLEMENT
    cycle: int = 0
    impl_result: Dict[str, Any] = field(default_factory=dict)
    diff_result: Dict[str, Any] = field(default_factory=dict)
    analysis_result: Dict[str, Any] = field(default_factory=dict)
    unknowns: List[Dict] = field(default_factory=list)
    issues: List[Dict] = field(default_factory=list)
    decisions: List[Dict] = field(default_factory=list)
    history: List[Dict] = field(default_factory=list)

    def transition(self, next_phase: Phase, reason: str):
        self.history.append({
            "from": self.phase.name,
            "to": next_phase.name,
            "reason": reason,
            "cycle": self.cycle,
            "at": datetime.now().isoformat()
        })
        print(f"  {self.phase.name} -> {next_phase.name}: {reason}")
        self.phase = next_phase

# ============================================
# コア状態遷移ロジック
# ============================================

class CoreStateMachine:
    """コア状態遷移マシン（エージェントなし）"""

    def __init__(self):
        self.state = CycleState()

    def run_cycle(self, has_diff: bool = True, has_unknowns: bool = True, open_issues: int = 0):
        """1サイクルを手動シミュレート"""
        self.state.cycle += 1
        print(f"\n{'='*50}")
        print(f"Cycle {self.state.cycle}")
        print(f"{'='*50}")

        # IMPLEMENT
        print(f"\n[{self.state.phase.name}]")
        self.state.transition(Phase.REVIEW, "実装完了")

        # REVIEW
        print(f"\n[{self.state.phase.name}]")
        if has_diff:
            self.state.transition(Phase.ANALYZE, "差分検出")
        elif open_issues > 0:
            self.state.issues = [{"id": f"ISSUE-{i}"} for i in range(open_issues)]
            self.state.transition(Phase.INVESTIGATE, f"{open_issues}件のオープンIssue")
        else:
            self.state.transition(Phase.DONE, "差分なし、Issueなし")
            return

        if self.state.phase == Phase.DONE:
            return

        # ANALYZE
        print(f"\n[{self.state.phase.name}]")
        self.state.transition(Phase.EXTRACT, "原因特定完了")

        # EXTRACT
        print(f"\n[{self.state.phase.name}]")
        if has_unknowns:
            self.state.unknowns = [{"id": "AMB-001", "question": "テスト質問"}]
            self.state.transition(Phase.ISSUE, "曖昧点抽出")
        else:
            self.state.transition(Phase.IMPLEMENT, "曖昧点なし、再実装へ")
            return

        # ISSUE
        print(f"\n[{self.state.phase.name}]")
        self.state.issues = self.state.unknowns
        self.state.transition(Phase.INVESTIGATE, f"{len(self.state.issues)}件Issue化")

        # INVESTIGATE
        print(f"\n[{self.state.phase.name}]")
        confident = True  # 調査で確信が得られた
        if confident:
            self.state.transition(Phase.DOCUMENT, "調査完了、確信あり")
        else:
            self.state.transition(Phase.IMPLEMENT, "確信なし、再実装へ")
            return

        # DOCUMENT
        print(f"\n[{self.state.phase.name}]")
        self.state.decisions.append({"id": f"DEC-{len(self.state.decisions)+1}"})
        self.state.transition(Phase.IMPLEMENT, "要件化完了、次サイクルへ")

    def report(self):
        print(f"\n{'='*50}")
        print("最終レポート")
        print(f"{'='*50}")
        print(f"サイクル数: {self.state.cycle}")
        print(f"最終フェーズ: {self.state.phase.name}")
        print(f"決定事項: {len(self.state.decisions)}")
        print(f"\n状態遷移履歴:")
        for h in self.state.history:
            print(f"  [{h['cycle']}] {h['from']} -> {h['to']}: {h['reason']}")


def main():
    print("=" * 50)
    print("コア状態遷移マシン テスト")
    print("=" * 50)

    sm = CoreStateMachine()

    # サイクル1: 差分あり、曖昧点あり
    print("\n[テスト1] 差分あり、曖昧点あり")
    sm.run_cycle(has_diff=True, has_unknowns=True)

    # サイクル2: 差分あり、曖昧点なし
    print("\n[テスト2] 差分あり、曖昧点なし")
    sm.run_cycle(has_diff=True, has_unknowns=False)

    # サイクル3: 差分なし、オープンIssueあり
    print("\n[テスト3] 差分なし、オープンIssue 2件")
    sm.run_cycle(has_diff=False, has_unknowns=False, open_issues=2)

    # サイクル4: 差分なし、Issueなし -> DONE
    print("\n[テスト4] 差分なし、Issueなし -> 完了")
    sm.run_cycle(has_diff=False, has_unknowns=False, open_issues=0)

    sm.report()


if __name__ == "__main__":
    main()
