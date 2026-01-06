"""
レビューエージェント - コードレビュー・仕様検証
実装がspec.yamlの決定事項を満たすか検証し、承認または却下を行う
"""
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
from datetime import datetime

from .base import BaseAgent, AgentRole, AgentResponse


class CheckResult(Enum):
    """チェック結果"""
    OK = "OK"
    NG = "NG"


class VerificationResult(Enum):
    """検証結果"""
    PASS = "PASS"
    FAIL = "FAIL"


@dataclass
class CheckItem:
    """チェック項目"""
    decision_id: str
    result: CheckResult
    reason: str = ""


@dataclass
class Verification:
    """検証"""
    task_id: str
    check_items: list[CheckItem] = field(default_factory=list)
    overall_result: VerificationResult = VerificationResult.FAIL
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Approval:
    """承認"""
    task_id: str
    confirmed_items: str
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Rejection:
    """却下"""
    task_id: str
    issues: list[str] = field(default_factory=list)
    fix_suggestion: str = ""
    created_at: datetime = field(default_factory=datetime.now)


REVIEWER_PROMPT = """
あなたはコードレビュアーです。

## 役割
- 実装が spec.yaml の決定事項を満たすか検証する
- 要件との一致を確認する
- 問題があれば具体的に指摘する

## 使える発言タイプ

【検証】
  対象: 実装の検証結果
  形式:
    【検証】
    タスク: TASK-XXX
    チェック項目:
      - DEC-001: OK / NG（理由）
      - DEC-002: OK / NG（理由）
    総合: PASS / FAIL

【承認】
  対象: 検証PASSの場合
  形式:
    【承認】
    タスク: TASK-XXX
    確認事項: （何を確認したか）

【却下】
  対象: 検証FAILの場合
  形式:
    【却下】
    タスク: TASK-XXX
    問題点:
      - （具体的な問題1）
      - （具体的な問題2）
    修正案: （どう直すべきか）

## 制約
- 主観で判断しない。spec.yaml を基準にする
- 曖昧な却下はしない。具体的な問題と修正案を示す
- 自分でコードを修正しない

## 入力
オーケストレーターから以下が渡される:
- spec.yaml の内容
- タスク情報
- 対象ファイルパス

## 作業ディレクトリ
impl-repo のみ操作可能（読み取り中心）
"""


class ReviewerAgent(BaseAgent):
    """
    レビューエージェント

    責務:
    - 実装が spec.yaml の決定事項を満たすか検証
    - 要件との一致を確認
    - 問題があれば具体的に指摘
    """

    def __init__(
        self,
        working_dir: Path,
        model: str = "claude-sonnet-4-20250514",
        max_tokens: int = 8192,
    ):
        super().__init__(
            role=AgentRole.REVIEWER,
            working_dir=working_dir,
            model=model,
            max_tokens=max_tokens,
        )
        self.verifications: dict[str, Verification] = {}
        self.approvals: dict[str, Approval] = {}
        self.rejections: dict[str, Rejection] = {}

    @property
    def system_prompt(self) -> str:
        return REVIEWER_PROMPT + f"\n\n現在の作業ディレクトリ: {self.working_dir}"

    async def review(
        self,
        task_id: str,
        spec: str,
        file_paths: list[str] | None = None,
    ) -> AgentResponse:
        """実装をレビュー"""
        files_info = ""
        if file_paths:
            files_info = "\n対象ファイル:\n" + "\n".join(f"  - {f}" for f in file_paths)

        prompt = f"""以下のタスクの実装をレビューしてください:

タスクID: {task_id}

仕様 (spec.yaml):
{spec}
{files_info}

手順:
1. 仕様の決定事項を確認
2. 各決定事項に対して実装を検証
3. 【検証】形式で結果を報告
4. PASSなら【承認】、FAILなら【却下】を発行

主観ではなく、spec.yaml を基準に判断してください。"""

        response = await self.query(prompt)
        self._parse_statements(response.content)
        return response

    async def verify_decision(
        self,
        task_id: str,
        decision_id: str,
        decision_content: str,
        implementation: str,
    ) -> AgentResponse:
        """決定事項の検証"""
        prompt = f"""以下の決定事項が実装されているか検証してください:

タスク: {task_id}
決定事項ID: {decision_id}
決定内容: {decision_content}

実装:
{implementation}

【検証】形式で結果を報告してください。
- OK: 決定事項が正しく実装されている
- NG: 決定事項が実装されていない、または誤っている（理由を記載）"""

        response = await self.query(prompt)
        return response

    async def approve(
        self,
        task_id: str,
        confirmed_items: str,
    ) -> AgentResponse:
        """承認を発行"""
        prompt = f"""以下の承認を発行してください:

【承認】
タスク: {task_id}
確認事項: {confirmed_items}

承認の根拠を説明してください。"""

        response = await self.query(prompt)

        # 承認を保存
        self.approvals[task_id] = Approval(
            task_id=task_id,
            confirmed_items=confirmed_items,
        )

        return response

    async def reject(
        self,
        task_id: str,
        issues: list[str],
        fix_suggestion: str,
    ) -> AgentResponse:
        """却下を発行"""
        issues_str = "\n".join(f"      - {issue}" for issue in issues)

        prompt = f"""以下の却下を発行してください:

【却下】
タスク: {task_id}
問題点:
{issues_str}
修正案: {fix_suggestion}

各問題点の詳細と、修正案の根拠を説明してください。"""

        response = await self.query(prompt)

        # 却下を保存
        self.rejections[task_id] = Rejection(
            task_id=task_id,
            issues=issues,
            fix_suggestion=fix_suggestion,
        )

        return response

    async def verify_spec(
        self,
        spec: str,
        implementation: str,
    ) -> AgentResponse:
        """仕様と実装を照合"""
        prompt = f"""仕様と実装を照合検証してください:

仕様:
{spec}

実装概要:
{implementation}

【検証】形式で結果を報告してください。
各決定事項について OK/NG を判定し、総合結果を出してください。"""

        response = await self.query(prompt)
        self._parse_statements(response.content)
        return response

    async def check_requirements(
        self,
        requirements: str,
        implementation: str,
    ) -> AgentResponse:
        """要件との一致確認"""
        prompt = f"""実装が要件を満たしているか確認してください:

要件:
{requirements}

実装:
{implementation}

【検証】形式で結果を報告してください。
要件の各項目について満たしているか確認し、総合結果を出してください。"""

        response = await self.query(prompt)
        return response

    async def review_code_quality(
        self,
        file_path: str,
    ) -> AgentResponse:
        """コード品質レビュー（補助的）"""
        prompt = f"""ファイル「{file_path}」のコード品質をレビューしてください。

注意: これは補助的なレビューです。
主な判断基準は spec.yaml の決定事項です。

以下の観点で確認:
1. コードの可読性
2. エラーハンドリング
3. 明らかなバグ

問題があれば報告してください。"""

        response = await self.query(prompt)
        return response

    def _parse_statements(self, content: str):
        """発言を解析して保存"""
        # 【検証】を解析
        verify_pattern = r'【検証】\s*タスク:\s*(TASK-\d+)\s*チェック項目:\s*(.+?)\s*総合:\s*(\w+)'
        for match in re.finditer(verify_pattern, content, re.DOTALL):
            task_id, checks_str, overall = match.groups()

            # チェック項目を解析
            check_items = []
            check_pattern = r'-\s*(DEC-\d+):\s*(OK|NG)(?:（(.+?)）)?'
            for check_match in re.finditer(check_pattern, checks_str):
                dec_id, result, reason = check_match.groups()
                check_items.append(CheckItem(
                    decision_id=dec_id,
                    result=CheckResult(result),
                    reason=reason.strip() if reason else "",
                ))

            # 総合結果を解析
            try:
                overall_result = VerificationResult(overall.strip())
            except ValueError:
                overall_result = VerificationResult.FAIL

            self.verifications[task_id] = Verification(
                task_id=task_id,
                check_items=check_items,
                overall_result=overall_result,
            )

        # 【承認】を解析
        approve_pattern = r'【承認】\s*タスク:\s*(TASK-\d+)\s*確認事項:\s*(.+?)(?=【|$)'
        for match in re.finditer(approve_pattern, content, re.DOTALL):
            task_id, confirmed = match.groups()
            self.approvals[task_id] = Approval(
                task_id=task_id,
                confirmed_items=confirmed.strip(),
            )

        # 【却下】を解析
        reject_pattern = r'【却下】\s*タスク:\s*(TASK-\d+)\s*問題点:\s*(.+?)\s*修正案:\s*(.+?)(?=【|$)'
        for match in re.finditer(reject_pattern, content, re.DOTALL):
            task_id, issues_str, fix_suggestion = match.groups()

            # 問題点を解析
            issues = []
            for issue_match in re.finditer(r'-\s*(.+)', issues_str):
                issue = issue_match.group(1).strip()
                if issue and not issue.startswith('修正案'):
                    issues.append(issue)

            self.rejections[task_id] = Rejection(
                task_id=task_id,
                issues=issues,
                fix_suggestion=fix_suggestion.strip(),
            )

    def _parse_response(self, response: str) -> dict:
        """応答をパースしてデータを抽出"""
        self._parse_statements(response)

        data = {
            "verifications": [],
            "approvals": [],
            "rejections": [],
        }

        for v in self.verifications.values():
            data["verifications"].append({
                "task_id": v.task_id,
                "check_items": [
                    {
                        "decision_id": c.decision_id,
                        "result": c.result.value,
                        "reason": c.reason,
                    }
                    for c in v.check_items
                ],
                "overall_result": v.overall_result.value,
            })

        for a in self.approvals.values():
            data["approvals"].append({
                "task_id": a.task_id,
                "confirmed_items": a.confirmed_items,
            })

        for r in self.rejections.values():
            data["rejections"].append({
                "task_id": r.task_id,
                "issues": r.issues,
                "fix_suggestion": r.fix_suggestion,
            })

        return data

    def get_verification(self, task_id: str) -> Optional[Verification]:
        """検証結果を取得"""
        return self.verifications.get(task_id)

    def get_approval(self, task_id: str) -> Optional[Approval]:
        """承認を取得"""
        return self.approvals.get(task_id)

    def get_rejection(self, task_id: str) -> Optional[Rejection]:
        """却下を取得"""
        return self.rejections.get(task_id)

    def is_approved(self, task_id: str) -> bool:
        """タスクが承認されているか"""
        return task_id in self.approvals

    def is_rejected(self, task_id: str) -> bool:
        """タスクが却下されているか"""
        return task_id in self.rejections

    def get_all_verifications(self) -> list[Verification]:
        """全検証結果を取得"""
        return list(self.verifications.values())

    def get_pending_reviews(self) -> list[str]:
        """未レビューのタスクIDを取得"""
        reviewed = set(self.approvals.keys()) | set(self.rejections.keys())
        verified = set(self.verifications.keys())
        return list(verified - reviewed)
