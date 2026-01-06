"""
doc-repo用ターミナル
PM・記録・ドキュメント管理エージェントを管理
"""
from pathlib import Path
from typing import Optional
import logging

from .terminal_process import TerminalProcess, TerminalType
from ..agents import PMAgent, RecorderAgent, DocManagerAgent, AgentResponse


class DocTerminal(TerminalProcess):
    """doc-repo用ターミナル"""

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
    ):
        super().__init__(TerminalType.DOC, working_dir)
        self.model = model
        self.pm_agent: Optional[PMAgent] = None
        self.recorder_agent: Optional[RecorderAgent] = None
        self.doc_manager_agent: Optional[DocManagerAgent] = None
        self._initialize_agents()

    def _initialize_agents(self):
        """エージェントを初期化"""
        self.pm_agent = PMAgent(
            working_dir=self.working_dir,
            model=self.model,
        )
        self.recorder_agent = RecorderAgent(
            working_dir=self.working_dir,
            model=self.model,
        )
        self.doc_manager_agent = DocManagerAgent(
            working_dir=self.working_dir,
            model=self.model,
        )
        self.logger.info("DocTerminal agents initialized")

    def get_available_agents(self) -> list[str]:
        """利用可能なエージェントのリストを返す"""
        return ["pm", "recorder", "doc-manager"]

    async def get_next_task(self) -> AgentResponse:
        """次のタスクを取得（PMエージェント）"""
        if not self.pm_agent:
            raise RuntimeError("PM agent not initialized")

        return await self.pm_agent.get_next_task()

    async def get_spec(self, task_id: str) -> AgentResponse:
        """タスクの仕様を取得（PMエージェント）"""
        if not self.pm_agent:
            raise RuntimeError("PM agent not initialized")

        return await self.pm_agent.get_spec(task_id)

    async def record_result(
        self,
        task_id: str,
        result: str,
        status: str,
    ) -> AgentResponse:
        """結果を記録（記録エージェント）"""
        if not self.recorder_agent:
            raise RuntimeError("Recorder agent not initialized")

        return await self.recorder_agent.record_result(task_id, result, status)

    async def update_progress(
        self,
        task_id: str,
        progress: dict,
    ) -> AgentResponse:
        """進捗を更新（記録エージェント）"""
        if not self.recorder_agent:
            raise RuntimeError("Recorder agent not initialized")

        return await self.recorder_agent.update_progress(task_id, progress)

    async def query_pm(self, prompt: str) -> AgentResponse:
        """PMエージェントにクエリ"""
        if not self.pm_agent:
            raise RuntimeError("PM agent not initialized")

        return await self.pm_agent.query(prompt)

    async def query_recorder(self, prompt: str) -> AgentResponse:
        """記録エージェントにクエリ"""
        if not self.recorder_agent:
            raise RuntimeError("Recorder agent not initialized")

        return await self.recorder_agent.query(prompt)

    async def query_doc_manager(self, prompt: str) -> AgentResponse:
        """ドキュメント管理エージェントにクエリ"""
        if not self.doc_manager_agent:
            raise RuntimeError("Doc manager agent not initialized")

        return await self.doc_manager_agent.query_document(prompt)

    async def search_decision(self, keyword: str) -> AgentResponse:
        """決定事項を検索"""
        if not self.doc_manager_agent:
            raise RuntimeError("Doc manager agent not initialized")

        return await self.doc_manager_agent.search_decision(keyword)

    async def get_decision(self, decision_id: str) -> AgentResponse:
        """決定事項を取得"""
        if not self.doc_manager_agent:
            raise RuntimeError("Doc manager agent not initialized")

        return await self.doc_manager_agent.get_decision(decision_id)

    async def search_task_info(self, task_id: str) -> AgentResponse:
        """タスク情報を検索"""
        if not self.doc_manager_agent:
            raise RuntimeError("Doc manager agent not initialized")

        return await self.doc_manager_agent.search_task(task_id)

    async def get_document_summary(self) -> AgentResponse:
        """ドキュメントサマリーを取得"""
        if not self.doc_manager_agent:
            raise RuntimeError("Doc manager agent not initialized")

        return await self.doc_manager_agent.get_document_summary()
