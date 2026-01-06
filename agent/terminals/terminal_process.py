"""
ターミナルプロセス管理クラス
"""
import asyncio
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional
import logging


class TerminalType(Enum):
    """ターミナルの種類"""
    DOC = "doc"
    IMPL = "impl"


@dataclass
class CommandResult:
    """コマンド実行結果"""
    success: bool
    stdout: str
    stderr: str
    return_code: int


class TerminalProcess(ABC):
    """ターミナルプロセス管理の基底クラス"""

    def __init__(
        self,
        terminal_type: TerminalType,
        working_dir: Path,
    ):
        self.terminal_type = terminal_type
        self.working_dir = Path(working_dir).resolve()
        self.logger = logging.getLogger(f"terminal.{terminal_type.value}")
        self._ensure_working_dir()

    def _ensure_working_dir(self):
        """作業ディレクトリが存在することを確認"""
        if not self.working_dir.exists():
            self.working_dir.mkdir(parents=True)
            self.logger.info(f"Created working directory: {self.working_dir}")

    async def execute(
        self,
        command: str,
        timeout: int = 60,
    ) -> CommandResult:
        """コマンドを実行"""
        self.logger.info(f"Executing: {command}")

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                cwd=str(self.working_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )

            result = CommandResult(
                success=process.returncode == 0,
                stdout=stdout.decode("utf-8", errors="replace"),
                stderr=stderr.decode("utf-8", errors="replace"),
                return_code=process.returncode or 0,
            )

            self.logger.info(f"Command completed with code: {result.return_code}")
            return result

        except asyncio.TimeoutError:
            self.logger.error(f"Command timed out after {timeout}s")
            return CommandResult(
                success=False,
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                return_code=-1,
            )
        except Exception as e:
            self.logger.error(f"Command failed: {e}")
            return CommandResult(
                success=False,
                stdout="",
                stderr=str(e),
                return_code=-1,
            )

    async def git_status(self) -> CommandResult:
        """git statusを実行"""
        return await self.execute("git status")

    async def git_pull(self) -> CommandResult:
        """git pullを実行"""
        return await self.execute("git pull")

    async def git_push(self) -> CommandResult:
        """git pushを実行"""
        return await self.execute("git push")

    async def git_add(self, files: str = ".") -> CommandResult:
        """git addを実行"""
        return await self.execute(f"git add {files}")

    async def git_commit(self, message: str) -> CommandResult:
        """git commitを実行"""
        return await self.execute(f'git commit -m "{message}"')

    async def read_file(self, file_path: str) -> Optional[str]:
        """ファイルを読み込む"""
        full_path = self.working_dir / file_path
        try:
            return full_path.read_text(encoding="utf-8")
        except Exception as e:
            self.logger.error(f"Failed to read file {file_path}: {e}")
            return None

    async def write_file(self, file_path: str, content: str) -> bool:
        """ファイルを書き込む"""
        full_path = self.working_dir / file_path
        try:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            return True
        except Exception as e:
            self.logger.error(f"Failed to write file {file_path}: {e}")
            return False

    @abstractmethod
    def get_available_agents(self) -> list[str]:
        """利用可能なエージェントのリストを返す"""
        pass
