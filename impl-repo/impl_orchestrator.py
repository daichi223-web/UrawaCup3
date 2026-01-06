#!/usr/bin/env python3
"""
impl-repo 実装エージェント
specに基づいてコードを実装し、記録する

Claude Agent SDK を使用したバージョン
"""

import asyncio
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, AsyncIterator

# Claude Agent SDK (正しいインポート)
try:
    from claude_agent_sdk import query, ClaudeAgentOptions
    USE_AGENT_SDK = True
except ImportError:
    # フォールバック: anthropic SDK を直接使用
    from anthropic import Anthropic
    USE_AGENT_SDK = False
    print("[警告] claude-agent-sdk が見つかりません。anthropic SDK を使用します。")
    print("       インストール: pip install claude-agent-sdk")

# ============================================
# 設定
# ============================================

DOC_REPO_PATH = Path("./doc-repo")
IMPL_REPO_PATH = Path("./impl-repo")

# ============================================
# プロンプト定義
# ============================================

DEVELOPER_PROMPT = """
あなたは開発者です。

## 役割
- specに基づいてコードを実装
- テストを書いて動作確認
- 実装内容を報告

## 入力
- spec.yaml: 決定事項
- タスク: 実装すべき内容

## 出力形式

【実装】
タスク: {タスク内容}
変更ファイル:
  - path/to/file.ts: 追加/変更/削除
内容: （何を実装したか）
テスト: PASS / FAIL / なし

【質問】
内容: （specに書かれていない不明点）

## 制約
- specに書かれていないことは実装しない
- 不明点は【質問】で報告
- 推測でコードを書かない
"""

IMPL_RECORDER_PROMPT = """
あなたは実装側の記録係です。

## 役割
- 実装活動の記録
- 変更ファイルの追跡
- 質問の記録

## 記録先ファイル
- impl-log.md: 実装活動ログ
- changes.yaml: 変更ファイル一覧
- questions.yaml: 未解決の質問

## 制約
- 記録のみ
- コードを変更しない
"""

# ============================================
# ファイル操作
# ============================================

def load_yaml(path: Path) -> dict:
    """YAML読み込み"""
    import yaml
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

def save_yaml(path: Path, data: dict):
    """YAML保存"""
    import yaml
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.dump(data, allow_unicode=True, default_flow_style=False),
        encoding="utf-8"
    )

def append_log(path: Path, entry: str):
    """ログ追記"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"\n---\n{datetime.now().isoformat()}\n{entry}\n")

def git_pull(repo_path: Path):
    """git pull"""
    if not (repo_path / ".git").exists():
        print(f"[git] {repo_path} は Git リポジトリではありません。スキップ。")
        return
    result = subprocess.run(
        ["git", "pull"],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    print(f"[git pull] {repo_path}: {result.stdout.strip()}")

def git_push(repo_path: Path, message: str):
    """git add, commit, push"""
    if not (repo_path / ".git").exists():
        print(f"[git] {repo_path} は Git リポジトリではありません。スキップ。")
        return
    subprocess.run(["git", "add", "."], cwd=repo_path)
    result = subprocess.run(
        ["git", "commit", "-m", message],
        cwd=repo_path,
        capture_output=True,
        text=True
    )
    if "nothing to commit" not in result.stdout:
        subprocess.run(["git", "push"], cwd=repo_path)
        print(f"[git push] {message}")
    else:
        print("[git] nothing to commit")

# ============================================
# エージェント実行 (Claude Agent SDK版)
# ============================================

async def run_agent_sdk(role: str, task: str, cwd: str = ".") -> str:
    """Claude Agent SDK を使用してエージェントを実行"""

    prompts = {
        "developer": DEVELOPER_PROMPT,
        "recorder": IMPL_RECORDER_PROMPT,
    }

    tools = {
        "developer": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        "recorder": ["Read", "Write", "Edit", "Glob"],
    }

    full_prompt = f"{prompts.get(role, '')}\n\n## タスク\n{task}"

    result_text = []

    options = ClaudeAgentOptions(
        allowed_tools=tools.get(role, ["Read"]),
        cwd=cwd,
        permission_mode="acceptEdits"
    )

    async for message in query(prompt=full_prompt, options=options):
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    result_text.append(block.text)
                    print(f"[{role}] {block.text[:100]}...")
        elif hasattr(message, 'result'):
            result_text.append(str(message.result))
            print(f"[{role}] Result: {str(message.result)[:100]}...")

    return "\n".join(result_text)

# ============================================
# エージェント実行 (Anthropic SDK フォールバック版)
# ============================================

class AnthropicAgent:
    """Anthropic SDK を使用したエージェント (フォールバック)"""

    def __init__(self):
        self.client = Anthropic()
        self.conversation_history = []

    def query(self, prompt: str, system_prompt: str) -> str:
        """エージェントにクエリを送信"""
        self.conversation_history.append({
            "role": "user",
            "content": prompt
        })

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=system_prompt,
            messages=self.conversation_history,
        )

        assistant_message = response.content[0].text

        self.conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })

        return assistant_message

    def reset(self):
        self.conversation_history = []

# グローバルエージェントインスタンス
_fallback_agents = {}

async def run_agent_fallback(role: str, task: str, cwd: str = ".") -> str:
    """Anthropic SDK を使用してエージェントを実行 (フォールバック)"""

    prompts = {
        "developer": DEVELOPER_PROMPT,
        "recorder": IMPL_RECORDER_PROMPT,
    }

    full_prompt = f"{prompts.get(role, '')}\n\n## タスク\n{task}\n\n作業ディレクトリ: {cwd}"

    if role not in _fallback_agents:
        _fallback_agents[role] = AnthropicAgent()

    agent = _fallback_agents[role]
    result = agent.query(task, full_prompt)

    print(f"[{role}] {result[:100]}...")

    return result

# ============================================
# 統合エージェント実行関数
# ============================================

async def run_agent(role: str, task: str, cwd: str = ".") -> str:
    """エージェントを実行 (SDKの有無に応じて切り替え)"""
    if USE_AGENT_SDK:
        return await run_agent_sdk(role, task, cwd)
    else:
        return await run_agent_fallback(role, task, cwd)

# ============================================
# 実装オーケストレーター
# ============================================

class ImplOrchestrator:
    """実装側オーケストレーター"""

    def __init__(self, doc_repo: Path = None, impl_repo: Path = None):
        self.doc_repo = doc_repo or DOC_REPO_PATH
        self.impl_repo = impl_repo or IMPL_REPO_PATH
        self.max_cycles = 10
        self.cycle = 0

        # パスを絶対パスに変換
        self.doc_repo = Path(self.doc_repo).resolve()
        self.impl_repo = Path(self.impl_repo).resolve()

        # ファイルパス
        self.spec_file = self.doc_repo / "spec.yaml"
        self.tasks_file = self.doc_repo / "tasks.yaml"
        self.impl_log = self.impl_repo / "impl-log.md"
        self.changes_file = self.impl_repo / "changes.yaml"
        self.questions_file = self.impl_repo / "questions.yaml"

    async def run(self):
        """メインループ"""
        print("=" * 60)
        print("実装オーケストレーター起動")
        print(f"doc-repo: {self.doc_repo}")
        print(f"impl-repo: {self.impl_repo}")
        print(f"SDK: {'Claude Agent SDK' if USE_AGENT_SDK else 'Anthropic SDK (フォールバック)'}")
        print("=" * 60)

        # 初期化
        self._init_files()

        while self.cycle < self.max_cycles:
            self.cycle += 1
            print(f"\n{'='*40}")
            print(f"サイクル {self.cycle}/{self.max_cycles}")
            print(f"{'='*40}")

            # 1. doc-repoからpull（最新spec取得）
            git_pull(self.doc_repo)

            # 2. spec読み込み
            spec = self._load_spec()
            if not spec:
                print("specが空です。doc-repoの更新を待機...")
                await asyncio.sleep(5)
                continue

            # 3. 未実装タスク取得
            tasks = self._get_pending_tasks(spec)
            if not tasks:
                print("未実装タスクなし")
                break

            print(f"未実装タスク: {len(tasks)}件")

            # 4. 開発者: 実装
            for task in tasks[:3]:  # 一度に最大3件
                print(f"\n--- タスク: {task['id']} ---")
                impl_result = await self._implement(task, spec)

                # 5. 記録
                await self._record_implementation(task, impl_result)

                # 6. 質問があれば記録
                if "【質問】" in impl_result:
                    await self._record_question(task, impl_result)

            # 7. git push
            git_push(self.impl_repo, f"Cycle {self.cycle}: Implementation")

            # 8. 全タスク完了チェック
            remaining = self._get_pending_tasks(spec)
            if not remaining:
                print("\n✅ 全タスク実装完了")
                break

        # 最終レポート
        await self._final_report()

    def _init_files(self):
        """初期ファイル作成"""
        self.impl_repo.mkdir(parents=True, exist_ok=True)

        if not self.impl_log.exists():
            self.impl_log.write_text(
                f"# 実装ログ\n\n開始: {datetime.now().isoformat()}\n",
                encoding="utf-8"
            )

        if not self.changes_file.exists():
            save_yaml(self.changes_file, {"changes": []})

        if not self.questions_file.exists():
            save_yaml(self.questions_file, {"questions": []})

    def _load_spec(self) -> dict:
        """spec読み込み"""
        if not self.spec_file.exists():
            return {}
        return load_yaml(self.spec_file)

    def _get_pending_tasks(self, spec: dict) -> list:
        """未実装タスク取得"""
        decisions = spec.get("decisions", {})
        changes = load_yaml(self.changes_file).get("changes", [])
        implemented_ids = {c.get("decision_id") for c in changes if c.get("status") == "done"}

        pending = []
        for dec_id, dec_content in decisions.items():
            if dec_id not in implemented_ids:
                pending.append({
                    "id": dec_id,
                    "content": dec_content
                })

        return pending

    async def _implement(self, task: dict, spec: dict) -> str:
        """開発者に実装を依頼"""
        print(f"\n[実装] {task['id']}")

        prompt = f"""
以下の決定事項に基づいて実装してください。

## 決定事項
ID: {task['id']}
内容:
```
{json.dumps(task['content'], ensure_ascii=False, indent=2)}
```

## 全spec
```
{json.dumps(spec, ensure_ascii=False, indent=2)[:3000]}
```

## 作業ディレクトリ
{self.impl_repo}

実装して【実装】形式で報告してください。
specに書かれていないことは実装せず【質問】として報告してください。
"""

        result = await run_agent(
            role="developer",
            task=prompt,
            cwd=str(self.impl_repo)
        )

        append_log(self.impl_log, f"[Developer] {task['id']}\n{result}")

        return result

    async def _record_implementation(self, task: dict, impl_result: str):
        """実装結果を記録"""
        print(f"[記録] {task['id']}")

        changes = load_yaml(self.changes_file)
        changes_list = changes.get("changes", [])

        # 変更ファイル抽出（簡易）
        changed_files = []
        for line in impl_result.split("\n"):
            if line.strip().startswith("- ") and (":" in line or ".ts" in line or ".py" in line):
                changed_files.append(line.strip()[2:])

        change_entry = {
            "decision_id": task["id"],
            "timestamp": datetime.now().isoformat(),
            "files": changed_files,
            "status": "done" if "【質問】" not in impl_result else "pending",
            "summary": impl_result[:500]
        }

        changes_list.append(change_entry)
        changes["changes"] = changes_list
        save_yaml(self.changes_file, changes)

    async def _record_question(self, task: dict, impl_result: str):
        """質問を記録"""
        print(f"[質問記録] {task['id']}")

        questions = load_yaml(self.questions_file)
        questions_list = questions.get("questions", [])

        # 質問抽出（簡易）
        question_text = ""
        in_question = False
        for line in impl_result.split("\n"):
            if "【質問】" in line:
                in_question = True
                continue
            if in_question:
                if line.startswith("【"):
                    break
                question_text += line + "\n"

        if question_text.strip():
            questions_list.append({
                "decision_id": task["id"],
                "question": question_text.strip(),
                "timestamp": datetime.now().isoformat(),
                "status": "open"
            })

        questions["questions"] = questions_list
        save_yaml(self.questions_file, questions)

    async def _final_report(self):
        """最終レポート"""
        print("\n" + "=" * 60)
        print("実装レポート")
        print("=" * 60)

        changes = load_yaml(self.changes_file)
        questions = load_yaml(self.questions_file)

        all_changes = changes.get("changes", [])
        done_changes = [c for c in all_changes if c.get("status") == "done"]
        pending_changes = [c for c in all_changes if c.get("status") == "pending"]

        all_questions = questions.get("questions", [])
        open_questions = [q for q in all_questions if q.get("status") == "open"]

        print(f"サイクル数: {self.cycle}")
        print(f"実装完了: {len(done_changes)}")
        print(f"実装保留: {len(pending_changes)}")
        print(f"未解決質問: {len(open_questions)}")

        if open_questions:
            print("\n未解決の質問:")
            for q in open_questions:
                print(f"  - {q['decision_id']}: {q['question'][:50]}...")

        print("\nファイル:")
        print(f"  - {self.impl_log}")
        print(f"  - {self.changes_file}")
        print(f"  - {self.questions_file}")

# ============================================
# 実行
# ============================================

async def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description="実装オーケストレーター")
    parser.add_argument("--doc-repo", type=str, default="./doc-repo", help="doc-repoのパス")
    parser.add_argument("--impl-repo", type=str, default="./impl-repo", help="impl-repoのパス")
    parser.add_argument("--max-cycles", type=int, default=10, help="最大サイクル数")

    args = parser.parse_args()

    orch = ImplOrchestrator(
        doc_repo=Path(args.doc_repo),
        impl_repo=Path(args.impl_repo)
    )
    orch.max_cycles = args.max_cycles

    await orch.run()

if __name__ == "__main__":
    try:
        import yaml
    except ImportError:
        print("PyYAML が必要です: pip install pyyaml")
        exit(1)

    asyncio.run(main())
