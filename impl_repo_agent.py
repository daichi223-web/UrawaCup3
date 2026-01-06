# impl_repo_agent.py

import asyncio
from anthropic import Anthropic

# ============================================
# プロンプト定義
# ============================================

DEVELOPER_PROMPT = """
あなたは開発者です。

## 役割
- タスクに基づいてコードを実装
- spec の決定事項に従う
- テストを書いて動作確認

## 発言フォーマット

【質問】
タスク: TASK-XXX
内容: （質問内容）

【実装】
タスク: TASK-XXX
変更ファイル:
  - path/to/file.ts（追加/変更/削除）
内容: （何を実装したか）
テスト: PASS / FAIL / なし

【修正】
タスク: TASK-XXX
指摘: （何を指摘されたか）
対応: （どう直したか）

## 制約
- specに書かれていないことは実装しない
- 不明点は【質問】で確認
- 推測でコードを書かない
"""

REVIEWER_PROMPT = """
あなたはコードレビュアーです。

## 役割
- 実装がspecを満たすか検証
- 要件との一致を確認
- 問題を具体的に指摘

## 発言フォーマット

【検証】
タスク: TASK-XXX
チェック項目:
  - DEC-001: OK / NG（理由）
  - DEC-002: OK / NG（理由）
総合: PASS / FAIL

【承認】
タスク: TASK-XXX
確認事項: （何を確認したか）

【却下】
タスク: TASK-XXX
問題点:
  - （具体的な問題）
修正案: （どう直すべきか）

## 制約
- specを基準に判断
- 曖昧な却下はしない
- 自分でコードを修正しない
"""

# ============================================
# メインプロンプト（このターミナルの司令塔）
# ============================================

IMPL_REPO_MAIN_PROMPT = """
あなたはimpl-repoの管理者です。

## このターミナルの責務
- コードの実装
- テストの実行
- コードレビュー
- Git操作

## 使えるサブエージェント
- developer: コード実装
- reviewer: コードレビュー

## ファイル構成
```
impl-repo/
├── src/              # ソースコード
├── tests/            # テストコード
├── spec.generated.ts # doc-repoから生成（参照用）
└── package.json
```

## オーケストレーターからの指示形式

[CMD:IMPLEMENT]
task: TASK-XXX
title: {タスクタイトル}
description: {詳細}
spec: {関連するspec内容}
→ developerを使って実装

[CMD:REVIEW]
task: TASK-XXX
spec: {spec.yaml内容}
files: {変更されたファイル一覧}
→ reviewerを使って検証、結果を返す

[CMD:GIT_PUSH]
message: {コミットメッセージ}
→ git add, commit, push を実行

[CMD:RUN_TESTS]
→ テストを実行、結果を返す

[CMD:FIX]
task: TASK-XXX
issues: {指摘内容}
→ developerを使って修正
"""


class ImplRepoAgent:
    """impl-repoエージェント"""

    def __init__(self, working_dir: str = "./impl-repo"):
        self.working_dir = working_dir
        self.client = Anthropic()
        self.conversation_history = []
        self.current_agent = None

    def _get_system_prompt(self, agent_type: str = None) -> str:
        """システムプロンプトを取得"""
        if agent_type == "developer":
            return DEVELOPER_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"
        elif agent_type == "reviewer":
            return REVIEWER_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"
        else:
            return IMPL_REPO_MAIN_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"

    def query(self, prompt: str, agent_type: str = None) -> str:
        """エージェントにクエリを送信"""
        self.conversation_history.append({
            "role": "user",
            "content": prompt
        })

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=self._get_system_prompt(agent_type),
            messages=self.conversation_history,
        )

        assistant_message = response.content[0].text

        self.conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })

        return assistant_message

    def implement(self, task_id: str, title: str, description: str, spec: str) -> str:
        """実装を行う"""
        prompt = f"""[CMD:IMPLEMENT]
task: {task_id}
title: {title}
description: {description}
spec: {spec}

このタスクを実装してください。【実装】形式で報告してください。"""

        return self.query(prompt, agent_type="developer")

    def review(self, task_id: str, spec: str, files: list = None) -> dict:
        """レビューを行う"""
        files_str = "\n".join(f"  - {f}" for f in (files or []))
        prompt = f"""[CMD:REVIEW]
task: {task_id}
spec: {spec}
files:
{files_str}

このタスクをレビューしてください。【検証】形式で報告してください。"""

        result = self.query(prompt, agent_type="reviewer")

        # 結果を解析
        status = "approved" if "PASS" in result or "【承認】" in result else "rejected"
        return {
            "status": status,
            "detail": result,
            "issues": [] if status == "approved" else [result]
        }

    def fix(self, task_id: str, issues: list) -> str:
        """修正を行う"""
        issues_str = "\n".join(f"  - {issue}" for issue in issues)
        prompt = f"""[CMD:FIX]
task: {task_id}
issues:
{issues_str}

指摘された問題を修正してください。【修正】形式で報告してください。"""

        return self.query(prompt, agent_type="developer")

    def run_tests(self) -> dict:
        """テストを実行"""
        prompt = "[CMD:RUN_TESTS]\n\nテストを実行して結果を報告してください。"
        result = self.query(prompt)

        passed = "PASS" in result.upper() or "成功" in result
        return {
            "passed": passed,
            "output": result
        }

    def git_push(self, message: str) -> str:
        """Git push"""
        prompt = f"""[CMD:GIT_PUSH]
message: {message}

git add, commit, push を実行してください。"""

        return self.query(prompt)

    def reset_conversation(self):
        """会話履歴をリセット"""
        self.conversation_history = []


async def main():
    """対話ループ"""
    print("=== impl-repo ターミナル起動 ===")
    print("オーケストレーターからの指示を待機...")
    print("コマンド: implement, review, fix, test, push, exit")

    agent = ImplRepoAgent(working_dir="D:/UrawaCup2/impl-repo")

    while True:
        try:
            command = input("\n[impl-repo] > ").strip()

            if command.lower() == "exit":
                break
            elif command.lower() == "reset":
                agent.reset_conversation()
                print("会話履歴をリセットしました")
            elif command.startswith("[CMD:"):
                # オーケストレーターからのコマンド
                result = agent.query(command)
                print(result)
            else:
                # 自由形式のクエリ
                result = agent.query(command)
                print(result)

        except KeyboardInterrupt:
            print("\n終了します")
            break
        except Exception as e:
            print(f"エラー: {e}")


if __name__ == "__main__":
    asyncio.run(main())
