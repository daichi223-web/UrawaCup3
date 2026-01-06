"""
記録エージェント - 決定・承認・却下の記録
spec.yaml, tasks.yaml, decisions.md への記録を担当
"""
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Any
from datetime import datetime

from .base import BaseAgent, AgentRole, AgentResponse


@dataclass
class DecisionRecord:
    """決定記録"""
    id: str
    what: str
    value: str
    reason: str
    by: str = "PM"
    at: datetime = field(default_factory=datetime.now)


@dataclass
class ApprovalRecord:
    """承認記録"""
    task_id: str
    approved_at: datetime = field(default_factory=datetime.now)


@dataclass
class RejectionRecord:
    """却下記録"""
    task_id: str
    reason: str
    rejected_at: datetime = field(default_factory=datetime.now)


RECORDER_PROMPT = """
あなたは記録係です。

## 役割
- 【決定】を spec.yaml に記録する
- 【承認】【却下】を tasks.yaml に反映する
- decisions.md に決定履歴を追記する

## 入力形式
オーケストレーターから構造化された発言が渡される

## 処理ルール

【決定】を受け取った場合:
  1. spec.yaml に追記
     DEC-XXX:
       what: {項目}
       value: {値}
       reason: {理由}
       by: PM
       at: {タイムスタンプ}
  2. decisions.md に追記

【承認】を受け取った場合:
  1. tasks.yaml のステータスを更新
     TASK-XXX:
       status: approved
       approved_at: {タイムスタンプ}

【却下】を受け取った場合:
  1. tasks.yaml のステータスを更新
     TASK-XXX:
       status: rejected
       rejected_at: {タイムスタンプ}
       reason: {問題点}

## 制約
- 発言しない。記録だけする
- 内容を解釈・変更しない
- 構造化されたフォーマットを厳守する

## 作業ディレクトリ
doc-repo のみ操作可能
"""


class RecorderAgent(BaseAgent):
    """
    記録エージェント

    責務:
    - 【決定】を spec.yaml に記録
    - 【承認】【却下】を tasks.yaml に反映
    - decisions.md に決定履歴を追記
    """

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 4096,
    ):
        super().__init__(
            role=AgentRole.RECORDER,
            working_dir=working_dir,
            model=model,
            max_tokens=max_tokens,
        )
        self.decisions: dict[str, DecisionRecord] = {}
        self.approvals: dict[str, ApprovalRecord] = {}
        self.rejections: dict[str, RejectionRecord] = {}

        # ファイルパス
        self.spec_path = self.working_dir / "spec.yaml"
        self.tasks_path = self.working_dir / "tasks.yaml"
        self.decisions_path = self.working_dir / "decisions.md"

    @property
    def system_prompt(self) -> str:
        return RECORDER_PROMPT + f"\n\n現在の作業ディレクトリ: {self.working_dir}"

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

    def _save_yaml(self, path: Path, data: dict) -> bool:
        """YAMLファイルを保存"""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
            return True
        except Exception as e:
            self.logger.error(f"Failed to save {path}: {e}")
            return False

    def _append_markdown(self, path: Path, content: str) -> bool:
        """Markdownファイルに追記"""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, 'a', encoding='utf-8') as f:
                f.write(content + "\n")
            return True
        except Exception as e:
            self.logger.error(f"Failed to append to {path}: {e}")
            return False

    async def record_decision(
        self,
        decision_id: str,
        what: str,
        value: str,
        reason: str,
        by: str = "PM",
    ) -> AgentResponse:
        """【決定】を記録"""
        timestamp = datetime.now()
        timestamp_str = timestamp.isoformat()

        # 1. spec.yaml に追記
        spec_data = self._load_yaml(self.spec_path)
        spec_data[decision_id] = {
            "what": what,
            "value": value,
            "reason": reason,
            "by": by,
            "at": timestamp_str,
        }
        spec_saved = self._save_yaml(self.spec_path, spec_data)

        # 2. decisions.md に追記
        md_content = f"""
## {decision_id}
- **項目**: {what}
- **値**: {value}
- **理由**: {reason}
- **決定者**: {by}
- **日時**: {timestamp_str}
"""
        md_saved = self._append_markdown(self.decisions_path, md_content)

        # 記録を保存
        self.decisions[decision_id] = DecisionRecord(
            id=decision_id,
            what=what,
            value=value,
            reason=reason,
            by=by,
            at=timestamp,
        )

        success = spec_saved and md_saved
        return AgentResponse(
            success=success,
            content=f"決定 {decision_id} を記録しました" if success else "記録に失敗しました",
            data={
                "decision_id": decision_id,
                "spec_saved": spec_saved,
                "md_saved": md_saved,
            }
        )

    async def record_approval(
        self,
        task_id: str,
    ) -> AgentResponse:
        """【承認】を記録"""
        timestamp = datetime.now()
        timestamp_str = timestamp.isoformat()

        # tasks.yaml を更新
        tasks_data = self._load_yaml(self.tasks_path)
        if task_id not in tasks_data:
            tasks_data[task_id] = {}
        tasks_data[task_id]["status"] = "approved"
        tasks_data[task_id]["approved_at"] = timestamp_str

        saved = self._save_yaml(self.tasks_path, tasks_data)

        # 記録を保存
        self.approvals[task_id] = ApprovalRecord(
            task_id=task_id,
            approved_at=timestamp,
        )

        return AgentResponse(
            success=saved,
            content=f"タスク {task_id} の承認を記録しました" if saved else "記録に失敗しました",
            data={
                "task_id": task_id,
                "status": "approved",
                "approved_at": timestamp_str,
            }
        )

    async def record_rejection(
        self,
        task_id: str,
        reason: str,
    ) -> AgentResponse:
        """【却下】を記録"""
        timestamp = datetime.now()
        timestamp_str = timestamp.isoformat()

        # tasks.yaml を更新
        tasks_data = self._load_yaml(self.tasks_path)
        if task_id not in tasks_data:
            tasks_data[task_id] = {}
        tasks_data[task_id]["status"] = "rejected"
        tasks_data[task_id]["rejected_at"] = timestamp_str
        tasks_data[task_id]["reason"] = reason

        saved = self._save_yaml(self.tasks_path, tasks_data)

        # 記録を保存
        self.rejections[task_id] = RejectionRecord(
            task_id=task_id,
            reason=reason,
            rejected_at=timestamp,
        )

        return AgentResponse(
            success=saved,
            content=f"タスク {task_id} の却下を記録しました" if saved else "記録に失敗しました",
            data={
                "task_id": task_id,
                "status": "rejected",
                "rejected_at": timestamp_str,
                "reason": reason,
            }
        )

    async def record_task(
        self,
        task_id: str,
        title: str,
        description: str,
        decisions: list[str],
        priority: int,
        status: str = "open",
    ) -> AgentResponse:
        """タスクを記録"""
        timestamp = datetime.now().isoformat()

        # tasks.yaml を更新
        tasks_data = self._load_yaml(self.tasks_path)
        tasks_data[task_id] = {
            "title": title,
            "description": description,
            "decisions": decisions,
            "priority": priority,
            "status": status,
            "created_at": timestamp,
        }

        saved = self._save_yaml(self.tasks_path, tasks_data)

        return AgentResponse(
            success=saved,
            content=f"タスク {task_id} を記録しました" if saved else "記録に失敗しました",
            data={
                "task_id": task_id,
                "title": title,
            }
        )

    async def update_task_status(
        self,
        task_id: str,
        status: str,
    ) -> AgentResponse:
        """タスクステータスを更新"""
        timestamp = datetime.now().isoformat()

        tasks_data = self._load_yaml(self.tasks_path)
        if task_id not in tasks_data:
            return AgentResponse(
                success=False,
                content=f"タスク {task_id} が見つかりません",
                error=f"Task {task_id} not found"
            )

        tasks_data[task_id]["status"] = status
        tasks_data[task_id]["updated_at"] = timestamp

        saved = self._save_yaml(self.tasks_path, tasks_data)

        return AgentResponse(
            success=saved,
            content=f"タスク {task_id} のステータスを {status} に更新しました",
            data={
                "task_id": task_id,
                "status": status,
            }
        )

    async def get_spec(self) -> AgentResponse:
        """spec.yaml の内容を取得"""
        spec_data = self._load_yaml(self.spec_path)
        return AgentResponse(
            success=True,
            content=yaml.dump(spec_data, allow_unicode=True, default_flow_style=False),
            data=spec_data,
        )

    async def get_tasks(self) -> AgentResponse:
        """tasks.yaml の内容を取得"""
        tasks_data = self._load_yaml(self.tasks_path)
        return AgentResponse(
            success=True,
            content=yaml.dump(tasks_data, allow_unicode=True, default_flow_style=False),
            data=tasks_data,
        )

    async def get_decisions_history(self) -> AgentResponse:
        """decisions.md の内容を取得"""
        if not self.decisions_path.exists():
            return AgentResponse(
                success=True,
                content="決定履歴なし",
                data={"history": []},
            )

        try:
            content = self.decisions_path.read_text(encoding='utf-8')
            return AgentResponse(
                success=True,
                content=content,
                data={"history": content},
            )
        except Exception as e:
            return AgentResponse(
                success=False,
                content="",
                error=str(e),
            )

    async def record_result(
        self,
        task_id: str,
        result: str,
        status: str,
    ) -> AgentResponse:
        """タスク結果を記録（互換性のため維持）"""
        timestamp = datetime.now().isoformat()

        tasks_data = self._load_yaml(self.tasks_path)
        if task_id not in tasks_data:
            tasks_data[task_id] = {}

        tasks_data[task_id]["status"] = status
        tasks_data[task_id]["result"] = result
        tasks_data[task_id]["completed_at"] = timestamp

        saved = self._save_yaml(self.tasks_path, tasks_data)

        return AgentResponse(
            success=saved,
            content=f"タスク {task_id} の結果を記録しました",
            data={
                "task_id": task_id,
                "status": status,
                "result": result,
            }
        )

    async def update_progress(
        self,
        task_id: str,
        progress: dict,
    ) -> AgentResponse:
        """進捗を更新（互換性のため維持）"""
        timestamp = datetime.now().isoformat()

        tasks_data = self._load_yaml(self.tasks_path)
        if task_id not in tasks_data:
            tasks_data[task_id] = {}

        tasks_data[task_id]["progress"] = progress
        tasks_data[task_id]["updated_at"] = timestamp

        saved = self._save_yaml(self.tasks_path, tasks_data)

        return AgentResponse(
            success=saved,
            content=f"タスク {task_id} の進捗を更新しました",
            data={
                "task_id": task_id,
                "progress": progress,
            }
        )

    def _parse_response(self, response: str) -> dict:
        """応答をパースしてデータを抽出"""
        return {
            "decisions": [
                {
                    "id": d.id,
                    "what": d.what,
                    "value": d.value,
                    "reason": d.reason,
                    "by": d.by,
                    "at": d.at.isoformat(),
                }
                for d in self.decisions.values()
            ],
            "approvals": [
                {
                    "task_id": a.task_id,
                    "approved_at": a.approved_at.isoformat(),
                }
                for a in self.approvals.values()
            ],
            "rejections": [
                {
                    "task_id": r.task_id,
                    "reason": r.reason,
                    "rejected_at": r.rejected_at.isoformat(),
                }
                for r in self.rejections.values()
            ],
        }

    def get_all_decisions(self) -> list[DecisionRecord]:
        """全決定記録を取得"""
        return list(self.decisions.values())

    def get_all_approvals(self) -> list[ApprovalRecord]:
        """全承認記録を取得"""
        return list(self.approvals.values())

    def get_all_rejections(self) -> list[RejectionRecord]:
        """全却下記録を取得"""
        return list(self.rejections.values())

    async def initialize_files(self) -> AgentResponse:
        """記録ファイルを初期化"""
        # spec.yaml
        if not self.spec_path.exists():
            self._save_yaml(self.spec_path, {"_meta": {"created_at": datetime.now().isoformat()}})

        # tasks.yaml
        if not self.tasks_path.exists():
            self._save_yaml(self.tasks_path, {"_meta": {"created_at": datetime.now().isoformat()}})

        # decisions.md
        if not self.decisions_path.exists():
            header = f"""# 決定履歴

作成日時: {datetime.now().isoformat()}

---
"""
            self._append_markdown(self.decisions_path, header)

        return AgentResponse(
            success=True,
            content="記録ファイルを初期化しました",
            data={
                "spec_path": str(self.spec_path),
                "tasks_path": str(self.tasks_path),
                "decisions_path": str(self.decisions_path),
            }
        )
