"""
状態定義モジュール
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Dict, Any, List
from datetime import datetime


class Phase(Enum):
    """フェーズ定義"""
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
    """サイクル状態"""
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
        """状態遷移を記録"""
        self.history.append({
            "from": self.phase.name,
            "to": next_phase.name,
            "reason": reason,
            "cycle": self.cycle,
            "at": datetime.now().isoformat()
        })
        print(f"  [{self.phase.name}] -> [{next_phase.name}]: {reason}")
        self.phase = next_phase

    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            "cycle": self.cycle,
            "phase": self.phase.name,
            "history": self.history,
            "decisions": self.decisions
        }
