"""
オーケストレーターエージェント

2つのリポジトリ（doc-repo, impl-repo）を分離管理し、
開発サイクルを自動化するエージェントシステム。

構造:
- orchestrator.py: メインオーケストレーター
- agents/: 各種エージェント（PM, 記録, 開発, レビュー）
- terminals/: ターミナルプロセス管理
- config.py: 設定

使用例:
    from agent import Orchestrator, OrchestratorConfig

    config = OrchestratorConfig()
    orchestrator = Orchestrator(config)
    results = await orchestrator.run()
"""
from .orchestrator import Orchestrator, CycleResult, CycleStatus, OrchestratorState
from .config import OrchestratorConfig, RepoConfig, AgentConfig, DEFAULT_CONFIG

__all__ = [
    "Orchestrator",
    "CycleResult",
    "CycleStatus",
    "OrchestratorState",
    "OrchestratorConfig",
    "RepoConfig",
    "AgentConfig",
    "DEFAULT_CONFIG",
]

__version__ = "0.1.0"
