"""
ドキュメント管理エージェント - ドキュメント検索・情報提供
他のエージェントからの問い合わせに応答し、関連情報を返す
"""
import yaml
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Any
from datetime import datetime

from .base import BaseAgent, AgentRole, AgentResponse


@dataclass
class SearchResult:
    """検索結果"""
    found: bool
    decision_id: Optional[str] = None
    task_id: Optional[str] = None
    content: str = ""
    location: str = ""
    line_number: Optional[int] = None
    related: list[str] = field(default_factory=list)


@dataclass
class DocumentInfo:
    """ドキュメント情報"""
    path: str
    content: dict | str
    line_count: int
    last_modified: Optional[datetime] = None


DOC_MANAGER_PROMPT = """
あなたはドキュメント管理者です。

## 役割
- 他のエージェントからの問い合わせに応答する
- ドキュメントの場所と内容を把握する
- 関連する決定事項を検索して返す

## 応答形式

問い合わせ: 「チーム数に関する決定は？」
応答:
  決定: DEC-001
  内容: teams.count = 24
  場所: spec.yaml L15
  関連: DEC-002 (teams.per_group = 6)

問い合わせ: 「TASK-003のレビュー結果は？」
応答:
  タスク: TASK-003
  状態: rejected
  場所: tasks.yaml L45
  理由: バリデーション未実装
  関連: reviews/TASK-003.md

## 制約
- ドキュメントを変更しない
- 解釈を加えない。事実だけ返す
- 見つからない場合は「該当なし」と明示する

## 作業ディレクトリ
doc-repo のみ操作可能（読み取りのみ）
"""


class DocManagerAgent(BaseAgent):
    """
    ドキュメント管理エージェント

    責務:
    - 他のエージェントからの問い合わせに応答
    - ドキュメントの場所と内容を把握
    - 関連する決定事項を検索して返す
    """

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
    ):
        super().__init__(
            role=AgentRole.PM,  # ドキュメント管理はPMの補助
            working_dir=working_dir,
            model=model,
            max_tokens=max_tokens,
        )

        # ドキュメントパス
        self.spec_path = self.working_dir / "spec.yaml"
        self.tasks_path = self.working_dir / "tasks.yaml"
        self.decisions_path = self.working_dir / "decisions.md"
        self.requirements_path = self.working_dir / "要件.md"
        self.reviews_dir = self.working_dir / "reviews"

        # キャッシュ
        self._spec_cache: Optional[dict] = None
        self._tasks_cache: Optional[dict] = None
        self._cache_time: Optional[datetime] = None

    @property
    def system_prompt(self) -> str:
        return DOC_MANAGER_PROMPT + f"\n\n現在の作業ディレクトリ: {self.working_dir}"

    def _load_yaml(self, path: Path) -> dict:
        """YAMLファイルを読み込む"""
        if not path.exists():
            return {}
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            self.logger.error(f"Failed to load {path}: {e}")
            return {}

    def _load_text(self, path: Path) -> str:
        """テキストファイルを読み込む"""
        if not path.exists():
            return ""
        try:
            return path.read_text(encoding='utf-8')
        except Exception as e:
            self.logger.error(f"Failed to load {path}: {e}")
            return ""

    def _find_line_number(self, path: Path, search_key: str) -> Optional[int]:
        """ファイル内でキーの行番号を検索"""
        if not path.exists():
            return None
        try:
            lines = path.read_text(encoding='utf-8').split('\n')
            for i, line in enumerate(lines, 1):
                if search_key in line:
                    return i
            return None
        except Exception:
            return None

    def _refresh_cache(self):
        """キャッシュを更新"""
        now = datetime.now()
        if self._cache_time is None or (now - self._cache_time).seconds > 30:
            self._spec_cache = self._load_yaml(self.spec_path)
            self._tasks_cache = self._load_yaml(self.tasks_path)
            self._cache_time = now

    def _get_spec(self) -> dict:
        """spec.yamlを取得（キャッシュ付き）"""
        self._refresh_cache()
        return self._spec_cache or {}

    def _get_tasks(self) -> dict:
        """tasks.yamlを取得（キャッシュ付き）"""
        self._refresh_cache()
        return self._tasks_cache or {}

    async def search_decision(self, keyword: str) -> AgentResponse:
        """決定事項を検索"""
        spec = self._get_spec()
        results = []

        for dec_id, dec_data in spec.items():
            if dec_id.startswith('_'):  # メタデータをスキップ
                continue
            if not isinstance(dec_data, dict):
                continue

            # キーワードでマッチング
            what = dec_data.get('what', '')
            value = str(dec_data.get('value', ''))
            reason = dec_data.get('reason', '')

            if keyword.lower() in f"{what} {value} {reason}".lower():
                line_num = self._find_line_number(self.spec_path, dec_id)
                results.append(SearchResult(
                    found=True,
                    decision_id=dec_id,
                    content=f"{what} = {value}",
                    location=f"spec.yaml L{line_num}" if line_num else "spec.yaml",
                    line_number=line_num,
                ))

        if not results:
            return AgentResponse(
                success=True,
                content="該当なし",
                data={"found": False, "results": []},
            )

        # 関連する決定を検索
        for result in results:
            result.related = self._find_related_decisions(result.decision_id, spec)

        response_text = self._format_decision_results(results)
        return AgentResponse(
            success=True,
            content=response_text,
            data={
                "found": True,
                "results": [
                    {
                        "decision_id": r.decision_id,
                        "content": r.content,
                        "location": r.location,
                        "related": r.related,
                    }
                    for r in results
                ],
            },
        )

    def _find_related_decisions(self, decision_id: str, spec: dict) -> list[str]:
        """関連する決定事項を検索"""
        related = []
        if not decision_id:
            return related

        # 同じプレフィックスを持つ決定を関連とみなす
        prefix = decision_id.split('-')[0] if '-' in decision_id else decision_id
        for dec_id in spec.keys():
            if dec_id.startswith('_'):
                continue
            if dec_id != decision_id and dec_id.startswith(prefix):
                related.append(dec_id)

        return related[:5]  # 最大5件

    def _format_decision_results(self, results: list[SearchResult]) -> str:
        """決定検索結果をフォーマット"""
        lines = []
        for r in results:
            lines.append(f"決定: {r.decision_id}")
            lines.append(f"内容: {r.content}")
            lines.append(f"場所: {r.location}")
            if r.related:
                lines.append(f"関連: {', '.join(r.related)}")
            lines.append("")
        return "\n".join(lines)

    async def search_task(self, task_id: str) -> AgentResponse:
        """タスク情報を検索"""
        tasks = self._get_tasks()

        if task_id not in tasks:
            return AgentResponse(
                success=True,
                content="該当なし",
                data={"found": False},
            )

        task_data = tasks[task_id]
        line_num = self._find_line_number(self.tasks_path, task_id)

        # レビューファイルの存在確認
        review_path = self.reviews_dir / f"{task_id}.md"
        review_exists = review_path.exists()

        related = []
        if review_exists:
            related.append(f"reviews/{task_id}.md")

        # 関連する決定事項
        decisions = task_data.get('decisions', [])
        if decisions:
            related.extend(decisions)

        response_text = f"""タスク: {task_id}
状態: {task_data.get('status', 'unknown')}
場所: tasks.yaml L{line_num if line_num else '?'}"""

        if task_data.get('reason'):
            response_text += f"\n理由: {task_data['reason']}"
        if related:
            response_text += f"\n関連: {', '.join(related)}"

        return AgentResponse(
            success=True,
            content=response_text,
            data={
                "found": True,
                "task_id": task_id,
                "status": task_data.get('status'),
                "location": f"tasks.yaml L{line_num}" if line_num else "tasks.yaml",
                "related": related,
                "data": task_data,
            },
        )

    async def get_decision(self, decision_id: str) -> AgentResponse:
        """特定の決定事項を取得"""
        spec = self._get_spec()

        if decision_id not in spec:
            return AgentResponse(
                success=True,
                content="該当なし",
                data={"found": False},
            )

        dec_data = spec[decision_id]
        line_num = self._find_line_number(self.spec_path, decision_id)
        related = self._find_related_decisions(decision_id, spec)

        response_text = f"""決定: {decision_id}
内容: {dec_data.get('what', '')} = {dec_data.get('value', '')}
場所: spec.yaml L{line_num if line_num else '?'}
理由: {dec_data.get('reason', '')}"""

        if related:
            response_text += f"\n関連: {', '.join(related)}"

        return AgentResponse(
            success=True,
            content=response_text,
            data={
                "found": True,
                "decision_id": decision_id,
                "data": dec_data,
                "location": f"spec.yaml L{line_num}" if line_num else "spec.yaml",
                "related": related,
            },
        )

    async def list_all_decisions(self) -> AgentResponse:
        """全決定事項をリスト"""
        spec = self._get_spec()
        decisions = []

        for dec_id, dec_data in spec.items():
            if dec_id.startswith('_'):
                continue
            if not isinstance(dec_data, dict):
                continue

            decisions.append({
                "id": dec_id,
                "what": dec_data.get('what', ''),
                "value": dec_data.get('value', ''),
            })

        if not decisions:
            return AgentResponse(
                success=True,
                content="決定事項なし",
                data={"decisions": []},
            )

        lines = ["全決定事項:"]
        for d in decisions:
            lines.append(f"  {d['id']}: {d['what']} = {d['value']}")

        return AgentResponse(
            success=True,
            content="\n".join(lines),
            data={"decisions": decisions},
        )

    async def list_all_tasks(self) -> AgentResponse:
        """全タスクをリスト"""
        tasks = self._get_tasks()
        task_list = []

        for task_id, task_data in tasks.items():
            if task_id.startswith('_'):
                continue
            if not isinstance(task_data, dict):
                continue

            task_list.append({
                "id": task_id,
                "title": task_data.get('title', ''),
                "status": task_data.get('status', 'unknown'),
            })

        if not task_list:
            return AgentResponse(
                success=True,
                content="タスクなし",
                data={"tasks": []},
            )

        lines = ["全タスク:"]
        for t in task_list:
            lines.append(f"  {t['id']}: [{t['status']}] {t['title']}")

        return AgentResponse(
            success=True,
            content="\n".join(lines),
            data={"tasks": task_list},
        )

    async def get_requirements(self) -> AgentResponse:
        """要件.mdの内容を取得"""
        content = self._load_text(self.requirements_path)

        if not content:
            return AgentResponse(
                success=True,
                content="要件.md が見つかりません",
                data={"found": False},
            )

        return AgentResponse(
            success=True,
            content=content,
            data={
                "found": True,
                "path": str(self.requirements_path),
                "content": content,
            },
        )

    async def get_review(self, task_id: str) -> AgentResponse:
        """タスクのレビュー結果を取得"""
        review_path = self.reviews_dir / f"{task_id}.md"

        if not review_path.exists():
            return AgentResponse(
                success=True,
                content="該当なし",
                data={"found": False},
            )

        content = self._load_text(review_path)

        return AgentResponse(
            success=True,
            content=content,
            data={
                "found": True,
                "task_id": task_id,
                "path": str(review_path),
                "content": content,
            },
        )

    async def query_document(self, query: str) -> AgentResponse:
        """自然言語でドキュメントを問い合わせ"""
        prompt = f"""以下の問い合わせに対して、ドキュメントを検索して応答してください:

問い合わせ: {query}

利用可能なドキュメント:
- spec.yaml: 決定事項
- tasks.yaml: タスク情報
- decisions.md: 決定履歴
- 要件.md: 要件定義
- reviews/: レビュー結果

応答形式に従って、事実だけを返してください。
見つからない場合は「該当なし」と明示してください。"""

        response = await self.query(prompt)
        return response

    async def get_document_summary(self) -> AgentResponse:
        """ドキュメントのサマリーを取得"""
        spec = self._get_spec()
        tasks = self._get_tasks()

        # 統計
        decision_count = len([k for k in spec.keys() if not k.startswith('_')])
        task_count = len([k for k in tasks.keys() if not k.startswith('_')])

        task_status = {}
        for task_id, task_data in tasks.items():
            if task_id.startswith('_'):
                continue
            if isinstance(task_data, dict):
                status = task_data.get('status', 'unknown')
                task_status[status] = task_status.get(status, 0) + 1

        # レビューファイル数
        review_count = 0
        if self.reviews_dir.exists():
            review_count = len(list(self.reviews_dir.glob("*.md")))

        summary = f"""ドキュメントサマリー:
  決定事項: {decision_count}件
  タスク: {task_count}件
  レビュー: {review_count}件

タスク状態:"""
        for status, count in task_status.items():
            summary += f"\n  - {status}: {count}件"

        return AgentResponse(
            success=True,
            content=summary,
            data={
                "decision_count": decision_count,
                "task_count": task_count,
                "review_count": review_count,
                "task_status": task_status,
            },
        )

    def _parse_response(self, response: str) -> dict:
        """応答をパースしてデータを抽出"""
        return {"raw": response}
