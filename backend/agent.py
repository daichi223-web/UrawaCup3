"""
エージェント実行モジュール
"""

import subprocess
import shutil
import os
from pathlib import Path
from typing import Optional

from .prompts import format_task_prompt


class AgentRunner:
    """Claude CLIエージェント実行"""

    def __init__(self, timeout: int = 300):
        self.timeout = timeout
        self.claude_path = shutil.which("claude")

    def is_available(self) -> bool:
        """Claude CLIが利用可能か"""
        return self.claude_path is not None

    async def run(self, role: str, task: str, cwd: Path) -> str:
        """エージェントを実行"""
        prompt = format_task_prompt(role, task)

        tools = "Read,Write,Edit,Glob,Grep"
        if role == "implementer":
            tools += ",Bash"

        if not self.claude_path:
            print(f"  [!] Claude CLI not found. Simulating {role}...")
            return self._simulate(role, task)

        try:
            env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'

            result = subprocess.run(
                [self.claude_path, "--print", "--output-format", "text", "--allowedTools", tools],
                cwd=str(cwd),
                input=prompt,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                env=env,
                timeout=self.timeout
            )

            if result.returncode == 0:
                return result.stdout
            else:
                print(f"  [!] Agent error: {result.stderr[:200]}")
                return f"Error: {result.stderr[:500]}"

        except subprocess.TimeoutExpired:
            return "Error: Timeout"
        except Exception as e:
            print(f"  [!] Claude CLI error ({e}). Simulating {role}...")
            return self._simulate(role, task)

    def _simulate(self, role: str, task: str) -> str:
        """シミュレーション出力"""
        simulations = {
            "implementer": """
【実装】
ファイル: src/main.py
内容: 基本構造を実装
確信度: 中

【不明】
項目: エラーハンドリングの方針
理由: specに記載なし
必要情報: エラー時の戻り値の形式
""",
            "reviewer": """
【差分】
種類: 不足
項目: バリデーション
要件: 入力値の検証が必要
実装: バリデーションなし
""",
            "analyzer": """
【分析】
差分: バリデーション不足
原因: 要件曖昧
詳細: バリデーションルールが明記されていない
対処: バリデーションルールを明確化
""",
            "extractor": """
【曖昧点】
ID: AMB-001
質問: 入力値の許容範囲は？
背景: バリデーションルールが不明
選択肢: 1-100 / 1-1000 / 制限なし
""",
            "investigator": """
【調査】
Issue: ISSUE-001
発見: 既存コードでは1-100の範囲チェックあり
根拠: validators.py:25
確度: 推測
""",
            "documenter": """
【決定】
ID: DEC-001
項目: 入力値の範囲
値: 1-100
理由: 既存実装との整合性
"""
        }
        return simulations.get(role, "")
