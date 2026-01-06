"""
状態遷移マシン本体
"""

import subprocess
from pathlib import Path

from .state import Phase, CycleState
from .agent import AgentRunner
from .handlers import PhaseHandlers
from .utils import save_yaml


class StateMachine:
    """状態遷移型オーケストレーター"""

    def __init__(
        self,
        doc_repo: Path,
        impl_repo: Path,
        max_cycles: int = 20,
        timeout: int = 300
    ):
        self.doc_repo = Path(doc_repo)
        self.impl_repo = Path(impl_repo)
        self.max_cycles = max_cycles

        self.state = CycleState()
        self.agent = AgentRunner(timeout=timeout)
        self.handlers = PhaseHandlers(self.doc_repo, self.impl_repo, self.agent)

        self._handler_map = {
            Phase.IMPLEMENT: self.handlers.implement,
            Phase.REVIEW: self.handlers.review,
            Phase.ANALYZE: self.handlers.analyze,
            Phase.EXTRACT: self.handlers.extract,
            Phase.ISSUE: self.handlers.issue,
            Phase.INVESTIGATE: self.handlers.investigate,
            Phase.DOCUMENT: self.handlers.document,
        }

    async def run(self):
        """オーケストレーションを実行"""
        print("=" * 60)
        print("状態遷移型オーケストレーター")
        print("=" * 60)
        print(f"doc-repo: {self.doc_repo.resolve()}")
        print(f"impl-repo: {self.impl_repo.resolve()}")
        print(f"Claude CLI: {'available' if self.agent.is_available() else 'simulation mode'}")
        print("=" * 60)

        self._init_repos()

        while self.state.phase != Phase.DONE and self.state.cycle < self.max_cycles:
            if self.state.phase == Phase.IMPLEMENT:
                self.state.cycle += 1
                print(f"\n{'#'*60}")
                print(f"Cycle {self.state.cycle}")
                print(f"{'#'*60}")

            handler = self._handler_map.get(self.state.phase)
            if handler:
                next_phase = await handler(self.state)
                self.state.transition(next_phase, "handler returned")
            else:
                break

            self._git_sync()

        self._report()

    def _init_repos(self):
        """リポジトリ初期化"""
        self.doc_repo.mkdir(parents=True, exist_ok=True)
        self.impl_repo.mkdir(parents=True, exist_ok=True)

        defaults = [
            (self.doc_repo / "issues.yaml", {"issues": []}),
            (self.doc_repo / "spec.yaml", {"decisions": {}}),
        ]

        for f, default in defaults:
            if not f.exists():
                save_yaml(f, default)

        log_file = self.doc_repo / "cycle-log.md"
        if not log_file.exists():
            from datetime import datetime
            log_file.write_text(
                f"# Cycle Log\n\nStarted: {datetime.now().isoformat()}\n",
                encoding="utf-8"
            )

    def _git_sync(self):
        """Gitコミット"""
        for repo in [self.doc_repo, self.impl_repo]:
            if (repo / ".git").exists():
                subprocess.run(["git", "add", "."], cwd=repo, capture_output=True)
                subprocess.run(
                    ["git", "commit", "-m", f"Cycle {self.state.cycle}: {self.state.phase.name}"],
                    cwd=repo, capture_output=True
                )

    def _report(self):
        """最終レポート出力"""
        print("\n" + "=" * 60)
        print("最終レポート")
        print("=" * 60)
        print(f"サイクル: {self.state.cycle}")
        print(f"最終フェーズ: {self.state.phase.name}")
        print(f"決定事項: {len(self.state.decisions)}")

        print("\n状態遷移履歴:")
        for h in self.state.history[-20:]:
            print(f"  [{h['cycle']}] {h['from']} -> {h['to']}")

        save_yaml(self.doc_repo / "final-state.yaml", self.state.to_dict())

        print(f"\n出力ファイル:")
        print(f"  - {self.doc_repo / 'spec.yaml'}")
        print(f"  - {self.doc_repo / 'issues.yaml'}")
        print(f"  - {self.doc_repo / 'cycle-log.md'}")
        print(f"  - {self.doc_repo / 'final-state.yaml'}")
