"""
PMエージェント - プロジェクトマネージャー
要件分析、タスク分解、決定発行を担当
"""
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
from datetime import datetime

from .base import BaseAgent, AgentRole, AgentResponse


class StatementType(Enum):
    """発言タイプ"""
    QUESTION = "質問"
    DECISION = "決定"
    TASK = "タスク"


@dataclass
class Question:
    """質問"""
    id: str
    content: str
    options: list[str] = field(default_factory=list)
    answer: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Decision:
    """決定"""
    id: str
    item: str
    value: str
    reason: str
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Task:
    """タスク"""
    id: str
    title: str
    description: str
    decisions: list[str] = field(default_factory=list)
    priority: int = 3
    status: str = "open"
    created_at: datetime = field(default_factory=datetime.now)


PM_PROMPT = """
あなたはプロジェクトマネージャー（PM）です。

## 役割
- 要件.md を分析してタスクに分解する
- 曖昧な点を明確にして【決定】を発行する
- タスクの優先順位を管理する

## 使える発言タイプ

【質問】
  対象: 要件の曖昧な点
  形式:
    【質問】
    ID: Q-XXX
    内容: （質問内容）
    選択肢: A案 / B案 / ...

【決定】
  対象: 確定した仕様
  形式:
    【決定】
    ID: DEC-XXX
    項目: （何を決めたか）
    値: （決定内容）
    理由: （なぜその決定か）

【タスク】
  対象: 実装すべき作業
  形式:
    【タスク】
    ID: TASK-XXX
    タイトル: （タスク名）
    説明: （詳細）
    決定事項: DEC-XXX, DEC-YYY
    優先度: 1-5
    状態: open

## 制約
- 実装の詳細には踏み込まない
- 技術的な決定は開発者に委ねる
- 曖昧なまま進めない。必ず【決定】を発行する

## 作業ディレクトリ
doc-repo のみ操作可能
"""


class PMAgent(BaseAgent):
    """
    PMエージェント: プロジェクトマネージャー

    責務:
    - 要件.md を分析してタスクに分解
    - 曖昧な点を明確にして【決定】を発行
    - タスクの優先順位を管理
    """

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
    ):
        super().__init__(
            role=AgentRole.PM,
            working_dir=working_dir,
            model=model,
            max_tokens=max_tokens,
        )
        self.questions: dict[str, Question] = {}
        self.decisions: dict[str, Decision] = {}
        self.tasks: dict[str, Task] = {}
        self._question_counter = 0
        self._decision_counter = 0
        self._task_counter = 0

    @property
    def system_prompt(self) -> str:
        return PM_PROMPT + f"\n\n現在の作業ディレクトリ: {self.working_dir}"

    def _generate_question_id(self) -> str:
        """質問IDを生成"""
        self._question_counter += 1
        return f"Q-{self._question_counter:03d}"

    def _generate_decision_id(self) -> str:
        """決定IDを生成"""
        self._decision_counter += 1
        return f"DEC-{self._decision_counter:03d}"

    def _generate_task_id(self) -> str:
        """タスクIDを生成"""
        self._task_counter += 1
        return f"TASK-{self._task_counter:03d}"

    async def analyze_requirements(self, requirements_path: str = "要件.md") -> AgentResponse:
        """要件を分析してタスクに分解"""
        prompt = f"""要件ファイル「{requirements_path}」を分析してください。

以下の手順で進めてください:

1. 要件を読み込む
2. 曖昧な点があれば【質問】を発行
3. 明確な点は【決定】として確定
4. 実装すべき作業を【タスク】として分解

出力は発言タイプの形式に従ってください。"""

        response = await self.query(prompt)
        self._parse_statements(response.content)
        return response

    async def ask_question(self, content: str, options: list[str]) -> AgentResponse:
        """質問を発行"""
        q_id = self._generate_question_id()
        options_str = " / ".join(options)

        prompt = f"""以下の質問を発行してください:

【質問】
ID: {q_id}
内容: {content}
選択肢: {options_str}

この質問の背景と、各選択肢のメリット・デメリットを説明してください。"""

        response = await self.query(prompt)

        # 質問を保存
        self.questions[q_id] = Question(
            id=q_id,
            content=content,
            options=options,
        )

        return response

    async def make_decision(self, item: str, value: str, reason: str) -> AgentResponse:
        """決定を発行"""
        d_id = self._generate_decision_id()

        prompt = f"""以下の決定を発行してください:

【決定】
ID: {d_id}
項目: {item}
値: {value}
理由: {reason}

この決定が他の要件や決定事項に与える影響も確認してください。"""

        response = await self.query(prompt)

        # 決定を保存
        self.decisions[d_id] = Decision(
            id=d_id,
            item=item,
            value=value,
            reason=reason,
        )

        return response

    async def create_task(
        self,
        title: str,
        description: str,
        decisions: list[str],
        priority: int = 3,
    ) -> AgentResponse:
        """タスクを作成"""
        t_id = self._generate_task_id()
        decisions_str = ", ".join(decisions) if decisions else "なし"

        prompt = f"""以下のタスクを作成してください:

【タスク】
ID: {t_id}
タイトル: {title}
説明: {description}
決定事項: {decisions_str}
優先度: {priority}
状態: open

このタスクの完了条件と、依存関係も明確にしてください。"""

        response = await self.query(prompt)

        # タスクを保存
        self.tasks[t_id] = Task(
            id=t_id,
            title=title,
            description=description,
            decisions=decisions,
            priority=priority,
            status="open",
        )

        return response

    async def get_next_task(self) -> AgentResponse:
        """次に実行すべきタスクを取得"""
        prompt = """現在のタスク一覧を確認し、次に実行すべきタスクを選定してください。

選定基準:
1. 状態が「open」のタスク
2. 優先度が高いもの（1が最高、5が最低）
3. 依存タスクが完了しているもの

選定したタスクを【タスク】形式で出力してください。
全タスク完了の場合は「全タスク完了」と報告してください。"""

        response = await self.query(prompt)
        return response

    async def get_spec(self, task_id: str) -> AgentResponse:
        """タスクの仕様を取得"""
        # 関連する決定事項を収集
        task = self.tasks.get(task_id)
        decisions_info = ""
        if task:
            for dec_id in task.decisions:
                dec = self.decisions.get(dec_id)
                if dec:
                    decisions_info += f"\n- {dec_id}: {dec.item} = {dec.value}"

        prompt = f"""タスク {task_id} の詳細仕様を整理してください。

関連する決定事項:{decisions_info if decisions_info else " なし"}

以下の形式で仕様を出力:
1. 目的
2. 入力/出力
3. 制約条件
4. 決定事項の適用
5. 完了条件"""

        response = await self.query(prompt)
        return response

    async def update_task_status(self, task_id: str, status: str) -> AgentResponse:
        """タスクのステータスを更新"""
        if task_id in self.tasks:
            self.tasks[task_id].status = status

        prompt = f"""タスク {task_id} のステータスを「{status}」に更新してください。

更新後の状況を報告してください。
残りのタスク一覧も表示してください。"""

        response = await self.query(prompt)
        return response

    async def answer_question(self, question_id: str, answer: str) -> AgentResponse:
        """質問に回答して決定を発行"""
        question = self.questions.get(question_id)
        if not question:
            return AgentResponse(
                success=False,
                content="",
                error=f"質問 {question_id} が見つかりません"
            )

        question.answer = answer

        prompt = f"""質問 {question_id} への回答を受けて、決定を発行してください。

質問内容: {question.content}
回答: {answer}

【決定】形式で確定事項を発行してください。"""

        response = await self.query(prompt)
        self._parse_statements(response.content)
        return response

    async def list_decisions(self) -> AgentResponse:
        """全決定事項をリスト"""
        prompt = """これまでに発行した全ての【決定】を一覧表示してください。

形式:
| ID | 項目 | 値 | 理由 |
|---|---|---|---|

まだ決定がない場合は「決定事項なし」と報告してください。"""

        response = await self.query(prompt)
        return response

    async def list_tasks(self) -> AgentResponse:
        """全タスクをリスト"""
        prompt = """これまでに作成した全ての【タスク】を一覧表示してください。

形式:
| ID | タイトル | 優先度 | 状態 | 決定事項 |
|---|---|---|---|---|

まだタスクがない場合は「タスクなし」と報告してください。"""

        response = await self.query(prompt)
        return response

    def _parse_statements(self, content: str):
        """発言を解析して保存"""
        # 【質問】を解析
        question_pattern = r'【質問】\s*ID:\s*(Q-\d+)\s*内容:\s*(.+?)\s*選択肢:\s*(.+?)(?=【|$)'
        for match in re.finditer(question_pattern, content, re.DOTALL):
            q_id, q_content, options_str = match.groups()
            options = [o.strip() for o in options_str.split('/')]
            if q_id not in self.questions:
                self.questions[q_id] = Question(
                    id=q_id,
                    content=q_content.strip(),
                    options=options,
                )

        # 【決定】を解析
        decision_pattern = r'【決定】\s*ID:\s*(DEC-\d+)\s*項目:\s*(.+?)\s*値:\s*(.+?)\s*理由:\s*(.+?)(?=【|$)'
        for match in re.finditer(decision_pattern, content, re.DOTALL):
            d_id, item, value, reason = match.groups()
            if d_id not in self.decisions:
                self.decisions[d_id] = Decision(
                    id=d_id,
                    item=item.strip(),
                    value=value.strip(),
                    reason=reason.strip(),
                )

        # 【タスク】を解析
        task_pattern = r'【タスク】\s*ID:\s*(TASK-\d+)\s*タイトル:\s*(.+?)\s*説明:\s*(.+?)\s*決定事項:\s*(.+?)\s*優先度:\s*(\d+)\s*状態:\s*(\w+)'
        for match in re.finditer(task_pattern, content, re.DOTALL):
            t_id, title, desc, decisions_str, priority, status = match.groups()
            decisions = [d.strip() for d in decisions_str.split(',') if d.strip()]
            if t_id not in self.tasks:
                self.tasks[t_id] = Task(
                    id=t_id,
                    title=title.strip(),
                    description=desc.strip(),
                    decisions=decisions,
                    priority=int(priority),
                    status=status.strip(),
                )

    def _parse_response(self, response: str) -> dict:
        """応答をパースしてデータを抽出"""
        data = {
            "questions": [],
            "decisions": [],
            "tasks": [],
        }

        # 発言を解析
        self._parse_statements(response)

        # パースした情報をdataに反映
        for q in self.questions.values():
            data["questions"].append({
                "id": q.id,
                "content": q.content,
                "options": q.options,
            })

        for d in self.decisions.values():
            data["decisions"].append({
                "id": d.id,
                "item": d.item,
                "value": d.value,
                "reason": d.reason,
            })

        for t in self.tasks.values():
            data["tasks"].append({
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "decisions": t.decisions,
                "priority": t.priority,
                "status": t.status,
            })

        return data

    def get_all_questions(self) -> list[Question]:
        """全質問を取得"""
        return list(self.questions.values())

    def get_all_decisions(self) -> list[Decision]:
        """全決定を取得"""
        return list(self.decisions.values())

    def get_all_tasks(self) -> list[Task]:
        """全タスクを取得"""
        return list(self.tasks.values())

    def get_open_tasks(self) -> list[Task]:
        """未完了タスクを取得"""
        return [t for t in self.tasks.values() if t.status == "open"]

    def get_task_by_priority(self) -> list[Task]:
        """優先度順にタスクを取得"""
        return sorted(self.tasks.values(), key=lambda t: t.priority)
