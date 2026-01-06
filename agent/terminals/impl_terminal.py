"""
impl-repo用ターミナル
開発・レビューエージェントを管理
"""
from pathlib import Path
from typing import Optional
import logging

from .terminal_process import TerminalProcess, TerminalType
from ..agents import DeveloperAgent, ReviewerAgent, AgentResponse


class ImplTerminal(TerminalProcess):
    """impl-repo用ターミナル"""

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
    ):
        super().__init__(TerminalType.IMPL, working_dir)
        self.model = model
        self.developer_agent: Optional[DeveloperAgent] = None
        self.reviewer_agent: Optional[ReviewerAgent] = None
        self._initialize_agents()

    def _initialize_agents(self):
        """エージェントを初期化"""
        self.developer_agent = DeveloperAgent(
            working_dir=self.working_dir,
            model=self.model,
        )
        self.reviewer_agent = ReviewerAgent(
            working_dir=self.working_dir,
            model=self.model,
        )
        self.logger.info("ImplTerminal agents initialized")

    def get_available_agents(self) -> list[str]:
        """利用可能なエージェントのリストを返す"""
        return ["developer", "reviewer"]

    async def implement_task(
        self,
        task_id: str,
        spec: str,
    ) -> AgentResponse:
        """タスクを実装（開発エージェント）"""
        if not self.developer_agent:
            raise RuntimeError("Developer agent not initialized")

        return await self.developer_agent.implement(task_id, spec)

    async def run_tests(self) -> AgentResponse:
        """テストを実行（開発エージェント）"""
        if not self.developer_agent:
            raise RuntimeError("Developer agent not initialized")

        return await self.developer_agent.run_tests()

    async def review_implementation(
        self,
        task_id: str,
        spec: str,
    ) -> AgentResponse:
        """実装をレビュー（レビューエージェント）"""
        if not self.reviewer_agent:
            raise RuntimeError("Reviewer agent not initialized")

        return await self.reviewer_agent.review(task_id, spec)

    async def verify_against_spec(
        self,
        spec: str,
        implementation: str,
    ) -> AgentResponse:
        """仕様と実装を照合（レビューエージェント）"""
        if not self.reviewer_agent:
            raise RuntimeError("Reviewer agent not initialized")

        return await self.reviewer_agent.verify_spec(spec, implementation)

    async def query_developer(self, prompt: str) -> AgentResponse:
        """開発エージェントにクエリ"""
        if not self.developer_agent:
            raise RuntimeError("Developer agent not initialized")

        return await self.developer_agent.query(prompt)

    async def query_reviewer(self, prompt: str) -> AgentResponse:
        """レビューエージェントにクエリ"""
        if not self.reviewer_agent:
            raise RuntimeError("Reviewer agent not initialized")

        return await self.reviewer_agent.query(prompt)
