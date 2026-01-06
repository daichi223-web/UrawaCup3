# orchestrator_main.py

import asyncio
import json
import yaml
from pathlib import Path
from anthropic import Anthropic


class DocRepoAgent:
    """doc-repoエージェント"""

    def __init__(self, working_dir: str):
        self.working_dir = Path(working_dir)
        self.client = Anthropic()
        self.conversation_history = []

    def _load_yaml(self, filename: str) -> dict:
        """YAMLファイルを読み込む"""
        path = self.working_dir / filename
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        return {}

    def _save_yaml(self, filename: str, data: dict):
        """YAMLファイルを保存"""
        path = self.working_dir / filename
        with open(path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False)

    def get_next_task(self) -> dict | None:
        """次のタスクを取得"""
        tasks = self._load_yaml("tasks.yaml")
        for task_id, task_data in tasks.items():
            if task_id.startswith('_'):
                continue
            if isinstance(task_data, dict) and task_data.get('status') == 'open':
                return {
                    "id": task_id,
                    "title": task_data.get('title', ''),
                    "description": task_data.get('description', ''),
                    "decisions": task_data.get('decisions', [])
                }
        return None

    def get_spec(self) -> str:
        """spec.yamlの内容を取得"""
        spec = self._load_yaml("spec.yaml")
        return yaml.dump(spec, allow_unicode=True, default_flow_style=False)

    def record_review(self, task_id: str, status: str, detail: str):
        """レビュー結果を記録"""
        tasks = self._load_yaml("tasks.yaml")
        if task_id in tasks:
            tasks[task_id]['status'] = status
            tasks[task_id]['review_detail'] = detail
        self._save_yaml("tasks.yaml", tasks)

    def analyze_requirements(self) -> str:
        """要件を分析"""
        req_path = self.working_dir / "要件.md"
        if req_path.exists():
            return req_path.read_text(encoding='utf-8')
        return ""


class ImplRepoAgent:
    """impl-repoエージェント"""

    def __init__(self, working_dir: str):
        self.working_dir = Path(working_dir)
        self.client = Anthropic()
        self.conversation_history = []

    def query(self, prompt: str, system_prompt: str = None) -> str:
        """クエリを送信"""
        self.conversation_history.append({
            "role": "user",
            "content": prompt
        })

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=system_prompt or "あなたは開発者兼レビュアーです。",
            messages=self.conversation_history,
        )

        result = response.content[0].text
        self.conversation_history.append({
            "role": "assistant",
            "content": result
        })

        return result


class Orchestrator:
    """2つのターミナルを制御"""

    def __init__(self, doc_repo_path: str, impl_repo_path: str):
        self.doc_agent = DocRepoAgent(doc_repo_path)
        self.impl_agent = ImplRepoAgent(impl_repo_path)
        self.cycle_count = 0
        self.max_cycles = 100
        self.max_retries = 3

    async def send_to_doc_repo(self, command: str) -> str:
        """doc-repoに指示を送る"""
        print(f"\n[→ doc-repo] {command[:50]}...")

        if command == "[CMD:GET_NEXT_TASK]":
            task = self.doc_agent.get_next_task()
            return task
        elif command == "[CMD:GET_SPEC]":
            return self.doc_agent.get_spec()
        elif command == "[CMD:ANALYZE_REQUIREMENTS]":
            return self.doc_agent.analyze_requirements()
        elif command.startswith("[CMD:RECORD_REVIEW]"):
            # パース
            lines = command.split('\n')
            task_id = ""
            status = ""
            detail = ""
            for line in lines:
                if line.startswith("task:"):
                    task_id = line.split(":", 1)[1].strip()
                elif line.startswith("result:"):
                    status = line.split(":", 1)[1].strip()
                elif line.startswith("detail:"):
                    detail = line.split(":", 1)[1].strip()
            self.doc_agent.record_review(task_id, status, detail)
            return "recorded"
        elif command == "[CMD:GET_TASK_STATUS]":
            tasks = self.doc_agent._load_yaml("tasks.yaml")
            return yaml.dump(tasks, allow_unicode=True)

        return ""

    async def send_to_impl_repo(self, command: str) -> str | dict:
        """impl-repoに指示を送る"""
        print(f"\n[→ impl-repo] {command[:50]}...")

        result = self.impl_agent.query(command)

        # レビュー結果を解析
        if "[CMD:REVIEW]" in command:
            status = "approved" if ("PASS" in result or "【承認】" in result) else "rejected"
            return {
                "status": status,
                "detail": result,
                "issues": [] if status == "approved" else [result]
            }

        return result

    async def run_cycle(self):
        """1サイクル実行"""
        self.cycle_count += 1
        print(f"\n{'='*50}")
        print(f"サイクル {self.cycle_count}")
        print(f"{'='*50}")

        # 1. 次のタスク取得
        task = await self.send_to_doc_repo("[CMD:GET_NEXT_TASK]")

        if not task:
            return "COMPLETE"

        print(f"\n[タスク] {task['id']}: {task['title']}")

        # 2. spec取得
        spec = await self.send_to_doc_repo("[CMD:GET_SPEC]")

        # 3. 実装指示
        impl_cmd = f"""[CMD:IMPLEMENT]
task: {task['id']}
title: {task['title']}
description: {task['description']}
spec: {spec}

このタスクを実装してください。【実装】形式で報告してください。
"""
        impl_result = await self.send_to_impl_repo(impl_cmd)
        print(f"\n[実装結果]\n{impl_result[:200]}...")

        # 4. git push
        await self.send_to_impl_repo(f"[CMD:GIT_PUSH]\nmessage: Implement {task['id']}")

        # 5. テスト実行
        test_result = await self.send_to_impl_repo("[CMD:RUN_TESTS]\n\nテストを実行してください。")
        print(f"\n[テスト結果]\n{test_result[:200]}...")

        # 6. レビュー
        review_cmd = f"""[CMD:REVIEW]
task: {task['id']}
spec: {spec}

実装をレビューしてください。【検証】形式で報告してください。
"""
        review_result = await self.send_to_impl_repo(review_cmd)
        print(f"\n[レビュー結果] {review_result['status']}")

        # 7. 結果記録
        record_cmd = f"""[CMD:RECORD_REVIEW]
task: {task['id']}
result: {review_result['status']}
detail: {review_result['detail'][:100]}
"""
        await self.send_to_doc_repo(record_cmd)

        # 8. 却下なら修正ループ
        retries = 0
        while review_result['status'] == 'rejected' and retries < self.max_retries:
            retries += 1
            print(f"\n[修正 {retries}/{self.max_retries}]")

            fix_cmd = f"""[CMD:FIX]
task: {task['id']}
issues: {review_result['issues']}

指摘を修正してください。【修正】形式で報告してください。
"""
            await self.send_to_impl_repo(fix_cmd)
            await self.send_to_impl_repo(f"[CMD:GIT_PUSH]\nmessage: Fix {task['id']}")

            review_result = await self.send_to_impl_repo(review_cmd)
            await self.send_to_doc_repo(f"""[CMD:RECORD_REVIEW]
task: {task['id']}
result: {review_result['status']}
detail: {review_result['detail'][:100]}
""")

        if review_result['status'] == 'rejected':
            print(f"\n[警告] {task['id']} が {self.max_retries}回却下されました")
            return "NEEDS_HUMAN"

        return "CONTINUE"

    async def run(self):
        """メインループ"""
        print("=== オーケストレーター起動 ===")

        # 初期化: 要件分析
        requirements = await self.send_to_doc_repo("[CMD:ANALYZE_REQUIREMENTS]")
        print(f"\n[要件]\n{requirements[:200]}...")

        while self.cycle_count < self.max_cycles:
            result = await self.run_cycle()

            if result == "COMPLETE":
                print("\n✅ 全タスク完了")
                break
            elif result == "NEEDS_HUMAN":
                print("\n⚠️ 人間の介入が必要です")
                user_input = input("続行するにはEnterを押してください (q で終了)...")
                if user_input.lower() == 'q':
                    break

        # 最終状態
        status = await self.send_to_doc_repo("[CMD:GET_TASK_STATUS]")
        print(f"\n最終状態:\n{status}")


async def main():
    orch = Orchestrator(
        doc_repo_path="D:/UrawaCup2/doc-repo",
        impl_repo_path="D:/UrawaCup2/impl-repo"
    )
    await orch.run()


if __name__ == "__main__":
    asyncio.run(main())
