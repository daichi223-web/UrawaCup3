"""
開発エージェント - コード実装・テスト実行
タスクに基づいてコードを実装し、テストを書いて動作確認
"""
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
from datetime import datetime

from .base import BaseAgent, AgentRole, AgentResponse


class FileChangeType(Enum):
    """ファイル変更タイプ"""
    ADD = "追加"
    MODIFY = "変更"
    DELETE = "削除"


class TestResult(Enum):
    """テスト結果"""
    PASS = "PASS"
    FAIL = "FAIL"
    NONE = "なし"


@dataclass
class FileChange:
    """ファイル変更"""
    path: str
    change_type: FileChangeType


@dataclass
class Implementation:
    """実装"""
    task_id: str
    files_changed: list[FileChange] = field(default_factory=list)
    content: str = ""
    test_result: TestResult = TestResult.NONE
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Fix:
    """修正"""
    task_id: str
    issue: str
    resolution: str
    files_changed: list[FileChange] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DeveloperQuestion:
    """開発者からの質問"""
    task_id: str
    content: str
    answer: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


DEVELOPER_PROMPT = """
あなたは開発者です。

## 役割
- タスクに基づいてコードを実装する
- spec.yaml の決定事項に従う
- テストを書いて動作確認する

## 使える発言タイプ

【質問】
  対象: 実装上の不明点
  形式:
    【質問】
    タスク: TASK-XXX
    内容: （質問内容）

【実装】
  対象: 完了した実装
  形式:
    【実装】
    タスク: TASK-XXX
    変更ファイル:
      - path/to/file1.ts（追加）
      - path/to/file2.ts（変更）
    内容: （何を実装したか）
    テスト: PASS / FAIL / なし

【修正】
  対象: 却下への対応
  形式:
    【修正】
    タスク: TASK-XXX
    指摘: （何を指摘されたか）
    対応: （どう直したか）
    変更ファイル:
      - path/to/file.ts

## 制約
- spec.yaml に書かれていないことは実装しない
- 不明点は【質問】で確認してから実装
- 推測でコードを書かない

## 作業ディレクトリ
impl-repo のみ操作可能
"""


class DeveloperAgent(BaseAgent):
    """
    開発エージェント

    責務:
    - タスクに基づいてコードを実装
    - spec.yaml の決定事項に従う
    - テストを書いて動作確認
    """

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 8192,
    ):
        super().__init__(
            role=AgentRole.DEVELOPER,
            working_dir=working_dir,
            model=model,
            max_tokens=max_tokens,
        )
        self.implementations: dict[str, Implementation] = {}
        self.fixes: list[Fix] = []
        self.questions: list[DeveloperQuestion] = []

    @property
    def system_prompt(self) -> str:
        return DEVELOPER_PROMPT + f"\n\n現在の作業ディレクトリ: {self.working_dir}"

    async def implement(self, task_id: str, spec: str) -> AgentResponse:
        """タスクを実装"""
        prompt = f"""以下のタスクを実装してください:

タスクID: {task_id}

仕様:
{spec}

手順:
1. 仕様を確認し、不明点があれば【質問】を発行
2. 実装に必要なファイルを特定
3. コードを実装
4. テストを作成・実行
5. 【実装】形式で報告

spec.yaml に書かれていないことは実装しないでください。"""

        response = await self.query(prompt)
        self._parse_statements(response.content)
        return response

    async def ask_implementation_question(
        self,
        task_id: str,
        content: str,
    ) -> AgentResponse:
        """実装上の質問を発行"""
        prompt = f"""以下の質問を発行してください:

【質問】
タスク: {task_id}
内容: {content}

この質問の背景と、実装に与える影響を説明してください。"""

        response = await self.query(prompt)

        # 質問を保存
        self.questions.append(DeveloperQuestion(
            task_id=task_id,
            content=content,
        ))

        return response

    async def report_implementation(
        self,
        task_id: str,
        files_changed: list[tuple[str, str]],  # (path, change_type)
        content: str,
        test_result: str = "なし",
    ) -> AgentResponse:
        """実装完了を報告"""
        files_str = "\n".join(
            f"      - {path}（{change_type}）"
            for path, change_type in files_changed
        )

        prompt = f"""以下の実装を報告してください:

【実装】
タスク: {task_id}
変更ファイル:
{files_str}
内容: {content}
テスト: {test_result}

実装の詳細を説明してください。"""

        response = await self.query(prompt)

        # 実装を保存
        self.implementations[task_id] = Implementation(
            task_id=task_id,
            files_changed=[
                FileChange(path=path, change_type=FileChangeType(change_type))
                for path, change_type in files_changed
            ],
            content=content,
            test_result=TestResult(test_result),
        )

        return response

    async def fix_issue(
        self,
        task_id: str,
        issue: str,
        resolution: str,
        files_changed: list[str],
    ) -> AgentResponse:
        """指摘への修正を報告"""
        files_str = "\n".join(f"      - {path}" for path in files_changed)

        prompt = f"""以下の修正を報告してください:

【修正】
タスク: {task_id}
指摘: {issue}
対応: {resolution}
変更ファイル:
{files_str}

修正の詳細を説明してください。"""

        response = await self.query(prompt)

        # 修正を保存
        self.fixes.append(Fix(
            task_id=task_id,
            issue=issue,
            resolution=resolution,
            files_changed=[
                FileChange(path=path, change_type=FileChangeType.MODIFY)
                for path in files_changed
            ],
        ))

        return response

    async def run_tests(self) -> AgentResponse:
        """テストを実行"""
        prompt = """プロジェクトのテストを実行してください。

以下のコマンドを試行:
1. npm test (Node.js/TypeScript)
2. pytest (Python)
3. go test ./... (Go)

結果を以下の形式で報告:

テスト結果: PASS / FAIL
総数: X
成功: X
失敗: X

失敗がある場合は詳細を記載してください。"""

        response = await self.query(prompt)
        return response

    async def analyze_spec(self, spec_path: str = "spec.yaml") -> AgentResponse:
        """仕様を分析"""
        prompt = f"""仕様ファイル「{spec_path}」を分析してください。

以下を確認:
1. 決定事項の一覧
2. 実装に必要な情報
3. 制約条件
4. テスト要件

実装に必要な情報を整理して報告してください。"""

        response = await self.query(prompt)
        return response

    async def create_file(self, file_path: str, content: str) -> AgentResponse:
        """ファイルを作成"""
        prompt = f"""以下のファイルを作成してください:

パス: {file_path}

内容:
```
{content}
```

作成後、【実装】形式で報告してください。"""

        response = await self.query(prompt)
        return response

    async def modify_file(
        self,
        file_path: str,
        changes: str,
    ) -> AgentResponse:
        """ファイルを変更"""
        prompt = f"""以下のファイルを変更してください:

パス: {file_path}

変更内容:
{changes}

変更後、【実装】形式で報告してください。"""

        response = await self.query(prompt)
        return response

    async def refactor(self, target: str, instructions: str) -> AgentResponse:
        """リファクタリング"""
        prompt = f"""以下のリファクタリングを行ってください:

対象: {target}

指示:
{instructions}

リファクタリング後、【実装】形式で報告してください。
テストが壊れていないことを確認してください。"""

        response = await self.query(prompt)
        return response

    def _parse_statements(self, content: str):
        """発言を解析して保存"""
        # 【質問】を解析
        question_pattern = r'【質問】\s*タスク:\s*(TASK-\d+)\s*内容:\s*(.+?)(?=【|$)'
        for match in re.finditer(question_pattern, content, re.DOTALL):
            task_id, q_content = match.groups()
            self.questions.append(DeveloperQuestion(
                task_id=task_id,
                content=q_content.strip(),
            ))

        # 【実装】を解析
        impl_pattern = r'【実装】\s*タスク:\s*(TASK-\d+)\s*変更ファイル:\s*(.+?)\s*内容:\s*(.+?)\s*テスト:\s*(\w+)'
        for match in re.finditer(impl_pattern, content, re.DOTALL):
            task_id, files_str, impl_content, test_result = match.groups()

            # ファイル変更を解析
            files_changed = []
            file_pattern = r'-\s*(.+?)（(.+?)）'
            for file_match in re.finditer(file_pattern, files_str):
                path, change_type = file_match.groups()
                try:
                    files_changed.append(FileChange(
                        path=path.strip(),
                        change_type=FileChangeType(change_type.strip()),
                    ))
                except ValueError:
                    files_changed.append(FileChange(
                        path=path.strip(),
                        change_type=FileChangeType.MODIFY,
                    ))

            # テスト結果を解析
            try:
                test = TestResult(test_result.strip())
            except ValueError:
                test = TestResult.NONE

            self.implementations[task_id] = Implementation(
                task_id=task_id,
                files_changed=files_changed,
                content=impl_content.strip(),
                test_result=test,
            )

        # 【修正】を解析
        fix_pattern = r'【修正】\s*タスク:\s*(TASK-\d+)\s*指摘:\s*(.+?)\s*対応:\s*(.+?)\s*変更ファイル:\s*(.+?)(?=【|$)'
        for match in re.finditer(fix_pattern, content, re.DOTALL):
            task_id, issue, resolution, files_str = match.groups()

            files_changed = []
            for file_match in re.finditer(r'-\s*(.+)', files_str):
                path = file_match.group(1).strip()
                if path:
                    files_changed.append(FileChange(
                        path=path,
                        change_type=FileChangeType.MODIFY,
                    ))

            self.fixes.append(Fix(
                task_id=task_id,
                issue=issue.strip(),
                resolution=resolution.strip(),
                files_changed=files_changed,
            ))

    def _parse_response(self, response: str) -> dict:
        """応答をパースしてデータを抽出"""
        self._parse_statements(response)

        data = {
            "implementations": [],
            "fixes": [],
            "questions": [],
        }

        for impl in self.implementations.values():
            data["implementations"].append({
                "task_id": impl.task_id,
                "files_changed": [
                    {"path": f.path, "change_type": f.change_type.value}
                    for f in impl.files_changed
                ],
                "content": impl.content,
                "test_result": impl.test_result.value,
            })

        for fix in self.fixes:
            data["fixes"].append({
                "task_id": fix.task_id,
                "issue": fix.issue,
                "resolution": fix.resolution,
                "files_changed": [f.path for f in fix.files_changed],
            })

        for q in self.questions:
            data["questions"].append({
                "task_id": q.task_id,
                "content": q.content,
                "answer": q.answer,
            })

        return data

    def get_implementation(self, task_id: str) -> Optional[Implementation]:
        """タスクの実装を取得"""
        return self.implementations.get(task_id)

    def get_all_implementations(self) -> list[Implementation]:
        """全実装を取得"""
        return list(self.implementations.values())

    def get_pending_questions(self) -> list[DeveloperQuestion]:
        """未回答の質問を取得"""
        return [q for q in self.questions if q.answer is None]

    def answer_question(self, index: int, answer: str):
        """質問に回答"""
        if 0 <= index < len(self.questions):
            self.questions[index].answer = answer
