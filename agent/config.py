"""
オーケストレーターエージェント設定
"""
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path


@dataclass
class RepoConfig:
    """リポジトリ設定"""
    name: str
    path: Path
    remote_url: Optional[str] = None
    branch: str = "main"


@dataclass
class AgentConfig:
    """エージェント設定"""
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096
    temperature: float = 0.7


@dataclass
class OrchestratorConfig:
    """オーケストレーター設定"""
    # リポジトリパス
    doc_repo: RepoConfig = field(default_factory=lambda: RepoConfig(
        name="doc-repo",
        path=Path("./doc-repo"),
    ))
    impl_repo: RepoConfig = field(default_factory=lambda: RepoConfig(
        name="impl-repo",
        path=Path("./impl-repo"),
    ))

    # エージェント設定
    agent: AgentConfig = field(default_factory=AgentConfig)

    # サイクル設定
    max_cycles: int = 100
    cycle_timeout: int = 300  # 秒

    # ログ設定
    log_level: str = "INFO"
    log_file: Optional[Path] = None


# デフォルト設定
DEFAULT_CONFIG = OrchestratorConfig()
