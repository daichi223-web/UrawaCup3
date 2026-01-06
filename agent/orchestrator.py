"""
オーケストレーター - メインプロセス制御
サイクル制御、エージェント間情報受け渡し、終了条件判定を担当
"""
import asyncio
import logging
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional
from datetime import datetime

from .config import OrchestratorConfig, DEFAULT_CONFIG
from .terminals import DocTerminal, ImplTerminal


ORCHESTRATOR_PROMPT = """
あなたはオーケストレーターです。

## 役割
- サイクルを制御する
- エージェント間の情報を受け渡す
- 終了条件を判定する

## サイクル

1. doc-repo: PMに次のタスクを聞く
2. doc-repo → impl-repo: タスク情報を渡す
3. impl-repo: 開発者が実装
4. impl-repo: git push
5. doc-repo: spec.yaml を読む
6. doc-repo → impl-repo: spec を渡す
7. impl-repo: レビュアーが検証
8. impl-repo → doc-repo: 結果を渡す
9. doc-repo: 記録係が記録
10. 1に戻る

## 終了条件
- tasks.yaml の全タスクが approved
- 未解決の【質問】がない

## エラー処理
- 同じタスクが3回却下 → 人間に介入要求
- 5回連続で【質問】 → 人間に介入要求

## 出力
各サイクルの要約をログ出力
"""


class CycleStatus(Enum):
    """サイクルの状態"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"
    NEEDS_HUMAN = "needs_human"


class StopReason(Enum):
    """停止理由"""
    ALL_TASKS_APPROVED = "all_tasks_approved"
    NO_PENDING_TASKS = "no_pending_tasks"
    MAX_REJECTIONS = "max_rejections"
    TOO_MANY_QUESTIONS = "too_many_questions"
    MAX_CYCLES = "max_cycles"
    ERROR = "error"
    USER_INTERRUPT = "user_interrupt"


@dataclass
class CycleResult:
    """サイクル実行結果"""
    cycle_number: int
    status: CycleStatus
    task_id: Optional[str] = None
    task_title: Optional[str] = None
    implementation_result: Optional[dict] = None
    review_result: Optional[dict] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class OrchestratorState:
    """オーケストレーターの状態"""
    current_cycle: int = 0
    total_tasks_completed: int = 0
    total_tasks_failed: int = 0
    is_running: bool = False
    last_error: Optional[str] = None
    cycle_history: list[CycleResult] = field(default_factory=list)
    rejection_counts: dict[str, int] = field(default_factory=dict)  # タスクごとの却下回数
    consecutive_questions: int = 0  # 連続質問カウント
    stop_reason: Optional[StopReason] = None


class Orchestrator:
    """
    オーケストレーター - メインプロセス

    サイクル:
    1. doc-repo: PMに次のタスクを聞く
    2. doc-repo → impl-repo: タスク情報を渡す
    3. impl-repo: 開発者が実装
    4. impl-repo: git push
    5. doc-repo: spec.yaml を読む
    6. doc-repo → impl-repo: spec を渡す
    7. impl-repo: レビュアーが検証
    8. impl-repo → doc-repo: 結果を渡す
    9. doc-repo: 記録係が記録
    10. 1に戻る

    終了条件:
    - tasks.yaml の全タスクが approved
    - 未解決の【質問】がない

    エラー処理:
    - 同じタスクが3回却下 → 人間に介入要求
    - 5回連続で【質問】 → 人間に介入要求
    """

    MAX_REJECTIONS_PER_TASK = 3
    MAX_CONSECUTIVE_QUESTIONS = 5

    def __init__(self, config: Optional[OrchestratorConfig] = None):
        self.config = config or DEFAULT_CONFIG
        self.state = OrchestratorState()
        self.logger = logging.getLogger("orchestrator")

        # ターミナル初期化
        self.doc_terminal: Optional[DocTerminal] = None
        self.impl_terminal: Optional[ImplTerminal] = None

    async def initialize(self):
        """オーケストレーターを初期化"""
        self.logger.info("Initializing Orchestrator...")

        # doc-repo ターミナル
        self.doc_terminal = DocTerminal(
            working_dir=self.config.doc_repo.path,
            model=self.config.agent.model,
        )

        # impl-repo ターミナル
        self.impl_terminal = ImplTerminal(
            working_dir=self.config.impl_repo.path,
            model=self.config.agent.model,
        )

        self.logger.info("Orchestrator initialized successfully")

    async def run(self) -> list[CycleResult]:
        """メインループを実行"""
        if not self.doc_terminal or not self.impl_terminal:
            await self.initialize()

        self.state.is_running = True
        results: list[CycleResult] = []

        try:
            while self.state.current_cycle < self.config.max_cycles:
                self.state.current_cycle += 1
                self.logger.info(f"=" * 50)
                self.logger.info(f"Starting cycle {self.state.current_cycle}")
                self.logger.info(f"=" * 50)

                result = await self._run_cycle()
                results.append(result)
                self.state.cycle_history.append(result)

                # サイクル結果をログ出力
                self._log_cycle_summary(result)

                if result.status == CycleStatus.COMPLETED:
                    if result.task_id is None:
                        self.logger.info("All tasks completed!")
                        self.state.stop_reason = StopReason.ALL_TASKS_APPROVED
                        break
                    self.state.total_tasks_completed += 1
                    self.state.consecutive_questions = 0  # 質問カウントリセット

                elif result.status == CycleStatus.FAILED:
                    self.state.total_tasks_failed += 1
                    self.state.last_error = result.error

                elif result.status == CycleStatus.NEEDS_HUMAN:
                    self.logger.warning(f"Human intervention required: {result.error}")
                    break

                elif result.status == CycleStatus.BLOCKED:
                    self.logger.warning(f"Cycle blocked: {result.error}")
                    break

        except KeyboardInterrupt:
            self.logger.info("User interrupt")
            self.state.stop_reason = StopReason.USER_INTERRUPT
        except Exception as e:
            self.logger.error(f"Orchestrator error: {e}")
            self.state.last_error = str(e)
            self.state.stop_reason = StopReason.ERROR
        finally:
            self.state.is_running = False

        return results

    async def _run_cycle(self) -> CycleResult:
        """1サイクルを実行（10ステップ）"""
        result = CycleResult(
            cycle_number=self.state.current_cycle,
            status=CycleStatus.RUNNING,
            started_at=datetime.now(),
        )

        try:
            # Step 1: doc-repo: PMに次のタスクを聞く
            self.logger.info("Step 1: Getting next task from PM")
            task_response = await self.doc_terminal.get_next_task()

            if not task_response.success:
                result.status = CycleStatus.FAILED
                result.error = task_response.error
                return result

            task_data = task_response.data

            # 全タスク完了チェック
            if task_data.get("done"):
                result.status = CycleStatus.COMPLETED
                result.task_id = None
                self.logger.info("All tasks completed")
                return result

            # 【質問】チェック
            if task_data.get("questions"):
                self.state.consecutive_questions += 1
                if self.state.consecutive_questions >= self.MAX_CONSECUTIVE_QUESTIONS:
                    result.status = CycleStatus.NEEDS_HUMAN
                    result.error = f"{self.MAX_CONSECUTIVE_QUESTIONS}回連続で【質問】が発生。人間の介入が必要です。"
                    return result
                # 質問がある場合は次のサイクルへ
                self.logger.info("Questions pending, waiting for answers")
                result.status = CycleStatus.BLOCKED
                result.error = "Pending questions"
                return result

            task_id = task_data.get("task_id")
            result.task_id = task_id
            result.task_title = task_data.get("title")

            # Step 2: doc-repo → impl-repo: タスク情報を渡す
            self.logger.info(f"Step 2: Getting spec for task {task_id}")
            spec_response = await self.doc_terminal.get_spec(task_id)

            if not spec_response.success:
                result.status = CycleStatus.FAILED
                result.error = spec_response.error
                return result

            spec = spec_response.content

            # Step 3: impl-repo: 開発者が実装
            self.logger.info(f"Step 3: Developer implementing task {task_id}")
            impl_response = await self.impl_terminal.implement_task(task_id, spec)

            if not impl_response.success:
                result.status = CycleStatus.FAILED
                result.error = impl_response.error
                return result

            result.implementation_result = impl_response.data

            # 開発者からの【質問】チェック
            if impl_response.data.get("questions"):
                self.state.consecutive_questions += 1
                self.logger.info("Developer has questions, waiting for answers")
                result.status = CycleStatus.BLOCKED
                result.error = "Developer has questions"
                return result

            # Step 4: impl-repo: git push
            self.logger.info("Step 4: Pushing implementation")
            await self.impl_terminal.git_add()
            await self.impl_terminal.git_commit(f"Implement task: {task_id}")
            await self.impl_terminal.git_push()

            # Step 5: doc-repo: spec.yaml を読む
            self.logger.info("Step 5: Reading spec.yaml")
            spec_content = await self.doc_terminal.query_pm("spec.yaml の内容を読み取ってください")

            # Step 6: doc-repo → impl-repo: spec を渡す
            self.logger.info("Step 6: Passing spec to reviewer")

            # Step 7: impl-repo: レビュアーが検証
            self.logger.info(f"Step 7: Reviewer verifying task {task_id}")
            review_response = await self.impl_terminal.review_implementation(
                task_id, spec_content.content
            )
            result.review_result = review_response.data

            # Step 8: impl-repo → doc-repo: 結果を渡す
            self.logger.info("Step 8: Passing review result to doc-repo")
            is_approved = review_response.data.get("approved", False)

            # 却下チェック
            if not is_approved:
                self.state.rejection_counts[task_id] = \
                    self.state.rejection_counts.get(task_id, 0) + 1

                if self.state.rejection_counts[task_id] >= self.MAX_REJECTIONS_PER_TASK:
                    result.status = CycleStatus.NEEDS_HUMAN
                    result.error = f"タスク {task_id} が{self.MAX_REJECTIONS_PER_TASK}回却下されました。人間の介入が必要です。"
                    return result

            # Step 9: doc-repo: 記録係が記録
            self.logger.info("Step 9: Recording result")
            if is_approved:
                await self.doc_terminal.record_result(
                    task_id=task_id,
                    result=review_response.content,
                    status="approved",
                )
            else:
                rejection_reason = review_response.data.get("issues", ["Unknown issue"])
                await self.doc_terminal.record_result(
                    task_id=task_id,
                    result=review_response.content,
                    status="rejected",
                )

            # doc-repo: git push
            self.logger.info("Step 10: Pushing doc changes")
            await self.doc_terminal.git_add()
            await self.doc_terminal.git_commit(f"Record result for task: {task_id}")
            await self.doc_terminal.git_push()

            result.status = CycleStatus.COMPLETED
            result.completed_at = datetime.now()

        except asyncio.TimeoutError:
            result.status = CycleStatus.FAILED
            result.error = "Cycle timed out"
        except Exception as e:
            result.status = CycleStatus.FAILED
            result.error = str(e)
            self.logger.error(f"Cycle error: {e}")

        return result

    def _log_cycle_summary(self, result: CycleResult):
        """サイクルの要約をログ出力"""
        self.logger.info("-" * 40)
        self.logger.info(f"Cycle {result.cycle_number} Summary:")
        self.logger.info(f"  Status: {result.status.value}")
        if result.task_id:
            self.logger.info(f"  Task: {result.task_id} - {result.task_title}")
        if result.review_result:
            approved = result.review_result.get("approved", False)
            self.logger.info(f"  Review: {'APPROVED' if approved else 'REJECTED'}")
        if result.error:
            self.logger.info(f"  Error: {result.error}")
        self.logger.info("-" * 40)

    async def run_single_cycle(self) -> CycleResult:
        """1サイクルのみ実行"""
        if not self.doc_terminal or not self.impl_terminal:
            await self.initialize()

        self.state.current_cycle += 1
        return await self._run_cycle()

    async def check_completion(self) -> bool:
        """全タスク完了を確認"""
        if not self.doc_terminal:
            return False

        tasks_response = await self.doc_terminal.query_recorder("全タスクのステータスを確認")
        tasks_data = tasks_response.data

        for task_id, task_info in tasks_data.items():
            if task_id.startswith('_'):
                continue
            if isinstance(task_info, dict):
                status = task_info.get('status', '')
                if status != 'approved':
                    return False

        return True

    async def check_pending_questions(self) -> list[str]:
        """未解決の質問を確認"""
        questions = []

        if self.doc_terminal and self.doc_terminal.pm_agent:
            pm_questions = self.doc_terminal.pm_agent.get_all_questions()
            for q in pm_questions:
                if q.answer is None:
                    questions.append(f"PM: {q.content}")

        if self.impl_terminal and self.impl_terminal.developer_agent:
            dev_questions = self.impl_terminal.developer_agent.get_pending_questions()
            for q in dev_questions:
                questions.append(f"Developer ({q.task_id}): {q.content}")

        return questions

    def get_state(self) -> OrchestratorState:
        """現在の状態を取得"""
        return self.state

    def get_summary(self) -> dict:
        """サマリーを取得"""
        return {
            "current_cycle": self.state.current_cycle,
            "total_completed": self.state.total_tasks_completed,
            "total_failed": self.state.total_tasks_failed,
            "is_running": self.state.is_running,
            "last_error": self.state.last_error,
            "stop_reason": self.state.stop_reason.value if self.state.stop_reason else None,
            "rejection_counts": self.state.rejection_counts,
            "consecutive_questions": self.state.consecutive_questions,
            "success_rate": (
                self.state.total_tasks_completed /
                max(1, self.state.total_tasks_completed + self.state.total_tasks_failed)
                * 100
            ),
        }

    def reset(self):
        """状態をリセット"""
        self.state = OrchestratorState()
        self.logger.info("Orchestrator state reset")
