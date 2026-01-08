"""
core - 状態遷移型オーケストレーター コアモジュール

Usage:
    from core import StateMachine, Phase, CycleState

    machine = StateMachine(
        doc_repo="./doc-repo",
        impl_repo="./impl-repo",
        max_cycles=20
    )
    await machine.run()
"""

from .state import Phase, CycleState
from .machine import StateMachine
from .agent import AgentRunner
from .prompts import PROMPTS, get_prompt, format_task_prompt
from .utils import load_yaml, save_yaml, append_log

__all__ = [
    # 状態
    "Phase",
    "CycleState",
    # マシン
    "StateMachine",
    # エージェント
    "AgentRunner",
    # プロンプト
    "PROMPTS",
    "get_prompt",
    "format_task_prompt",
    # ユーティリティ
    "load_yaml",
    "save_yaml",
    "append_log",
]

__version__ = "1.0.0"
