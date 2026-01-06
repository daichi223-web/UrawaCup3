# doc_repo_agent.py

import asyncio
import yaml
from pathlib import Path
from datetime import datetime
from anthropic import Anthropic

# ============================================
# プロンプト定義
# ============================================

PM_PROMPT = """
あなたはプロジェクトマネージャー（PM）です。

## 役割
- 要件.md を分析してタスクに分解
- 曖昧な点を明確にして【決定】を発行
- タスクの優先順位を管理

## 発言フォーマット

【質問】
ID: Q-XXX
内容: （質問内容）
選択肢: A案 / B案 / ...

【決定】
ID: DEC-XXX
項目: （何を決めたか）
値: （決定内容）
理由: （なぜその決定か）

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
- 曖昧なまま進めない
"""

RECORDER_PROMPT = """
あなたは記録係です。

## 役割
- 【決定】を spec.yaml に記録
- 【承認】【却下】を tasks.yaml に反映
- decisions.md に決定履歴を追記

## 制約
- 発言しない。記録だけする
- 内容を解釈・変更しない
- 構造化されたフォーマットを厳守
"""

DOC_MANAGER_PROMPT = """
あなたはドキュメント管理者です。

## 役割
- 問い合わせに応答
- ドキュメントの場所と内容を把握
- 関連する決定事項を検索

## 制約
- ドキュメントを変更しない
- 解釈を加えない
- 見つからない場合は「該当なし」
"""

DOC_REPO_MAIN_PROMPT = """
あなたはdoc-repoの管理者です。

## このターミナルの責務
- 要件分析
- タスク管理
- 決定事項の記録
- Git操作

## 使えるサブエージェント
- pm: 要件分析、タスク作成
- recorder: 記録
- doc-manager: ドキュメント検索

## オーケストレーターからの指示形式

[CMD:ANALYZE_REQUIREMENTS]
→ 要件.md を分析してタスクを作成

[CMD:GET_NEXT_TASK]
→ 次の未完了タスクを返す

[CMD:GET_SPEC]
→ spec.yaml の内容を返す

[CMD:RECORD_DECISION]
decision: {決定内容}
→ spec.yaml に記録

[CMD:RECORD_REVIEW]
task: TASK-XXX
result: approved / rejected
detail: {詳細}
→ tasks.yaml に記録
"""


class DocRepoAgent:
    """doc-repoエージェント"""

    def __init__(self, working_dir: str = "./doc-repo"):
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

    def _append_markdown(self, filename: str, content: str):
        """Markdownファイルに追記"""
        path = self.working_dir / filename
        with open(path, 'a', encoding='utf-8') as f:
            f.write(content + "\n")

    def _get_system_prompt(self, agent_type: str = None) -> str:
        """システムプロンプトを取得"""
        if agent_type == "pm":
            return PM_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"
        elif agent_type == "recorder":
            return RECORDER_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"
        elif agent_type == "doc-manager":
            return DOC_MANAGER_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"
        else:
            return DOC_REPO_MAIN_PROMPT + f"\n\n作業ディレクトリ: {self.working_dir}"

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

    def analyze_requirements(self) -> str:
        """要件を分析してタスクを作成"""
        req_path = self.working_dir / "要件.md"
        if not req_path.exists():
            return "要件.md が見つかりません"

        requirements = req_path.read_text(encoding='utf-8')

        prompt = f"""要件を分析してタスクを作成してください。

要件:
{requirements}

【決定】と【タスク】形式で出力してください。"""

        result = self.query(prompt, agent_type="pm")
        return result

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

    def record_decision(self, decision_id: str, what: str, value: str, reason: str):
        """決定を記録"""
        spec = self._load_yaml("spec.yaml")
        spec[decision_id] = {
            "what": what,
            "value": value,
            "reason": reason,
            "by": "PM",
            "at": datetime.now().isoformat()
        }
        self._save_yaml("spec.yaml", spec)

        # decisions.mdにも追記
        md_content = f"""
## {decision_id}
- **項目**: {what}
- **値**: {value}
- **理由**: {reason}
- **日時**: {datetime.now().isoformat()}
"""
        self._append_markdown("decisions.md", md_content)

    def record_task(self, task_id: str, title: str, description: str,
                    decisions: list = None, priority: int = 3):
        """タスクを記録"""
        tasks = self._load_yaml("tasks.yaml")
        tasks[task_id] = {
            "title": title,
            "description": description,
            "decisions": decisions or [],
            "priority": priority,
            "status": "open",
            "created_at": datetime.now().isoformat()
        }
        self._save_yaml("tasks.yaml", tasks)

    def record_review(self, task_id: str, status: str, detail: str):
        """レビュー結果を記録"""
        tasks = self._load_yaml("tasks.yaml")
        if task_id in tasks:
            tasks[task_id]['status'] = status
            tasks[task_id]['review_detail'] = detail
            tasks[task_id]['reviewed_at'] = datetime.now().isoformat()
        self._save_yaml("tasks.yaml", tasks)

    def reset_conversation(self):
        """会話履歴をリセット"""
        self.conversation_history = []


async def main():
    """対話ループ"""
    print("=== doc-repo ターミナル起動 ===")
    print("オーケストレーターからの指示を待機...")
    print("コマンド: analyze, next, spec, record, exit")

    agent = DocRepoAgent(working_dir="D:/UrawaCup2/doc-repo")

    while True:
        try:
            command = input("\n[doc-repo] > ").strip()

            if command.lower() == "exit":
                break
            elif command.lower() == "reset":
                agent.reset_conversation()
                print("会話履歴をリセットしました")
            elif command.lower() == "analyze":
                result = agent.analyze_requirements()
                print(result)
            elif command.lower() == "next":
                task = agent.get_next_task()
                if task:
                    print(f"次のタスク: {task}")
                else:
                    print("未完了タスクなし")
            elif command.lower() == "spec":
                print(agent.get_spec())
            elif command.startswith("[CMD:"):
                result = agent.query(command)
                print(result)
            else:
                result = agent.query(command)
                print(result)

        except KeyboardInterrupt:
            print("\n終了します")
            break
        except Exception as e:
            print(f"エラー: {e}")


if __name__ == "__main__":
    asyncio.run(main())
