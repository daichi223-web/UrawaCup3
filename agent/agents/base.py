"""
ベースエージェントクラス
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional
from pathlib import Path
import logging

from anthropic import Anthropic


class AgentRole(Enum):
    """エージェントの役割"""
    PM = "pm"
    RECORDER = "recorder"
    DEVELOPER = "developer"
    REVIEWER = "reviewer"


@dataclass
class AgentResponse:
    """エージェントの応答"""
    success: bool
    content: str
    data: dict = field(default_factory=dict)
    error: Optional[str] = None


class BaseAgent(ABC):
    """ベースエージェントクラス"""

    def __init__(
        self,
        role: AgentRole,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
    ):
        self.role = role
        self.working_dir = Path(working_dir)
        self.model = model
        self.max_tokens = max_tokens
        self.client = Anthropic()
        self.logger = logging.getLogger(f"agent.{role.value}")
        self.conversation_history: list[dict] = []

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """システムプロンプトを返す"""
        pass

    async def query(self, prompt: str, **kwargs) -> AgentResponse:
        """エージェントにクエリを送信"""
        self.logger.info(f"Query: {prompt[:100]}...")

        # 会話履歴に追加
        self.conversation_history.append({
            "role": "user",
            "content": prompt
        })

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self.system_prompt,
                messages=self.conversation_history,
            )

            assistant_message = response.content[0].text

            # 会話履歴に応答を追加
            self.conversation_history.append({
                "role": "assistant",
                "content": assistant_message
            })

            self.logger.info(f"Response: {assistant_message[:100]}...")

            return AgentResponse(
                success=True,
                content=assistant_message,
                data=self._parse_response(assistant_message)
            )

        except Exception as e:
            self.logger.error(f"Error: {e}")
            return AgentResponse(
                success=False,
                content="",
                error=str(e)
            )

    def _parse_response(self, response: str) -> dict:
        """応答をパースしてデータを抽出（サブクラスでオーバーライド可能）"""
        return {"raw": response}

    def reset_conversation(self):
        """会話履歴をリセット"""
        self.conversation_history = []
        self.logger.info("Conversation history reset")

    def get_working_dir(self) -> Path:
        """作業ディレクトリを取得"""
        return self.working_dir
