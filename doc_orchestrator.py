#!/usr/bin/env python3
"""
doc-repo 自動ドキュメント化オーケストレーター
要件と実装の差分を検出し、Issue化・ドキュメント化するサイクルを回す

使用方法:
    python doc_orchestrator.py

前提:
    - claude CLI がインストール済み
    - doc-repo/ と impl-repo/ が存在
"""

import subprocess
import json
import os
import sys
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
import yaml

# ============================================
# 設定
# ============================================

BASE_DIR = Path(__file__).parent.resolve()
DOC_REPO = BASE_DIR / "doc-repo"
IMPL_REPO = BASE_DIR / "impl-repo"
REQUIREMENTS_FILE = BASE_DIR / "urawacup_requirements.md"

# 出力ファイル
ISSUES_FILE = DOC_REPO / "issues.yaml"
SPEC_FILE = DOC_REPO / "spec.yaml"
DECISIONS_FILE = DOC_REPO / "decisions.md"
LOG_FILE = DOC_REPO / "log.md"
REVIEWS_DIR = DOC_REPO / "reviews"

MAX_CYCLES = 20
CYCLE_DELAY_SEC = 5

# ============================================
# プロンプト
# ============================================

REVIEWER_PROMPT = """あなたはレビュアーです。要件定義書と実装コードを比較し、差分を検出してください。

## 入力
1. 要件定義書: {requirements_file}
2. 実装コード: {impl_repo}
3. 既存の決定事項: {spec_file}
4. 既存のIssue: {issues_file}

## タスク
1. 要件定義書を読み、全ての機能要件を把握
2. 実装コードを読み、実際に実装されている機能を確認
3. 差分を検出:
   - 要件にあるが未実装の機能
   - 実装されているが要件に記載のない機能
   - 要件と実装の不一致
   - 仕様が不明確な箇所

## 出力形式（YAML）
```yaml
review:
  timestamp: "{timestamp}"
  cycle: {cycle}

  missing_in_impl:
    - id: "GAP-XXX"
      requirement: "要件の記述"
      location: "要件定義書のセクション"
      severity: high/medium/low

  missing_in_requirements:
    - id: "UNDOC-XXX"
      feature: "実装されている機能"
      location: "ファイルパス:行番号"

  mismatches:
    - id: "MISMATCH-XXX"
      requirement: "要件での記述"
      implementation: "実装での動作"
      location: "ファイルパス:行番号"

  unclear:
    - id: "UNCLEAR-XXX"
      description: "不明確な点"
      context: "背景・文脈"

  summary:
    total_gaps: N
    critical_gaps: N
    status: "差分あり" / "差分なし"
```

## 制約
- 事実のみを記載
- 推測で判断しない
- 既存のIssueと重複しないこと
- 既存のspec.yamlで解決済みの項目は除外
"""

PM_PROMPT = """あなたはPM（プロジェクトマネージャー）です。Issueを調査し、決定事項をドキュメント化してください。

## 入力
- Issue: {issue}
- 実装コード: {impl_repo}
- 要件定義書: {requirements_file}

## タスク
1. Issueの内容を理解
2. 実装コードを調査して事実を確認
3. 決定事項を導出（推測ではなく、実装から読み取れる事実のみ）
4. 不明点が残る場合は「要確認」として記録

## 出力形式（YAML）
```yaml
investigation:
  issue_id: "{issue_id}"
  timestamp: "{timestamp}"

  findings:
    - fact: "確認できた事実"
      source: "ファイルパス:行番号"

  decision:
    id: "DEC-XXX"
    what: "決定事項のタイトル"
    value: "決定内容"
    reason: "理由（実装から読み取った根拠）"

  remaining_questions:
    - question: "未解決の質問"
      context: "背景"
      options:
        - "選択肢1"
        - "選択肢2"

  status: "resolved" / "partially_resolved" / "needs_clarification"
```

## 制約
- 実装から読み取れる事実のみを記載
- 推測で決定しない
- ソースを必ず明記
"""

# ============================================
# ユーティリティ
# ============================================

def load_yaml(path: Path) -> dict:
    """YAML読み込み"""
    if not path.exists():
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        print(f"[WARN] YAML読み込みエラー: {path} - {e}")
        return {}

def save_yaml(path: Path, data: dict):
    """YAML保存"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

def append_log(message: str):
    """ログ追記"""
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"\n## {timestamp}\n{message}\n")

def append_decision(decision_id: str, content: str):
    """決定事項を追記"""
    DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(DECISIONS_FILE, 'a', encoding='utf-8') as f:
        f.write(f"\n---\n\n## {decision_id}\n\n**日時**: {timestamp}\n\n{content}\n")

def git_commit_push(message: str):
    """git add, commit, push"""
    try:
        subprocess.run(["git", "add", "."], cwd=DOC_REPO, check=True, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=DOC_REPO,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            subprocess.run(["git", "push"], cwd=DOC_REPO, capture_output=True)
            print(f"[GIT] Committed: {message}")
            return True
        elif "nothing to commit" in result.stdout or "nothing to commit" in result.stderr:
            print("[GIT] No changes to commit")
            return False
        else:
            print(f"[GIT] Commit failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"[GIT] Error: {e}")
        return False

# ============================================
# Claude CLI 実行
# ============================================

def run_claude(prompt: str, cwd: str = None, timeout: int = 300) -> Optional[str]:
    """claude CLIを実行して結果を取得"""
    if cwd is None:
        cwd = str(BASE_DIR)

    cmd = [
        "claude",
        "--print",           # 非インタラクティブモード
        "--output-format", "text",
        "-p", prompt
    ]

    try:
        print(f"[CLAUDE] 実行中... (cwd={cwd})")
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding='utf-8'
        )

        if result.returncode != 0:
            print(f"[CLAUDE] エラー: {result.stderr[:500]}")
            return None

        return result.stdout

    except subprocess.TimeoutExpired:
        print(f"[CLAUDE] タイムアウト ({timeout}秒)")
        return None
    except Exception as e:
        print(f"[CLAUDE] 実行エラー: {e}")
        return None

def extract_yaml_from_response(response: str) -> Optional[dict]:
    """レスポンスからYAMLブロックを抽出"""
    # ```yaml ... ``` ブロックを探す
    yaml_pattern = r'```yaml\s*(.*?)```'
    matches = re.findall(yaml_pattern, response, re.DOTALL)

    if matches:
        try:
            return yaml.safe_load(matches[0])
        except:
            pass

    # YAMLブロックがない場合、全体をパースしてみる
    try:
        return yaml.safe_load(response)
    except:
        return None

# ============================================
# オーケストレーター本体
# ============================================

class DocumentationOrchestrator:
    def __init__(self):
        self.cycle = 0
        self.total_issues_created = 0
        self.total_decisions_made = 0

    def run(self):
        """メインループ"""
        print("=" * 60)
        print("ドキュメント化オーケストレーター起動")
        print(f"要件: {REQUIREMENTS_FILE}")
        print(f"実装: {IMPL_REPO}")
        print(f"出力: {DOC_REPO}")
        print("=" * 60)

        self._init_files()

        while self.cycle < MAX_CYCLES:
            self.cycle += 1
            print(f"\n{'='*50}")
            print(f"サイクル {self.cycle}/{MAX_CYCLES}")
            print(f"{'='*50}")

            # 1. レビュー実行
            review_result = self._run_review()

            if review_result is None:
                print("[ERROR] レビュー失敗、リトライ...")
                continue

            # 2. 差分なしなら終了
            if not review_result.get("has_gaps", True):
                print("\n✅ 差分なし - ドキュメント化完了")
                break

            # 3. Issue登録
            new_issues = self._record_issues(review_result)

            if not new_issues:
                print("[INFO] 新規Issueなし、次のサイクルへ")
                continue

            # 4. PM調査
            for issue in new_issues[:3]:  # 1サイクル最大3件
                self._investigate_issue(issue)

            # 5. git push
            git_commit_push(f"Cycle {self.cycle}: {len(new_issues)} issues, {self.total_decisions_made} decisions")

            print(f"\nサイクル {self.cycle} 完了")
            print(f"  累計Issue: {self.total_issues_created}")
            print(f"  累計決定: {self.total_decisions_made}")

        self._final_report()

    def _init_files(self):
        """初期ファイル作成"""
        DOC_REPO.mkdir(parents=True, exist_ok=True)
        REVIEWS_DIR.mkdir(parents=True, exist_ok=True)

        if not ISSUES_FILE.exists():
            save_yaml(ISSUES_FILE, {"issues": [], "_meta": {"created_at": datetime.now().isoformat()}})

        if not LOG_FILE.exists():
            LOG_FILE.write_text(f"# ドキュメント化ログ\n\n開始: {datetime.now().isoformat()}\n", encoding='utf-8')

    def _run_review(self) -> Optional[dict]:
        """レビュー実行"""
        print("\n[Step 1] レビュー: 要件 vs 実装")

        timestamp = datetime.now().isoformat()

        prompt = REVIEWER_PROMPT.format(
            requirements_file=REQUIREMENTS_FILE,
            impl_repo=IMPL_REPO,
            spec_file=SPEC_FILE,
            issues_file=ISSUES_FILE,
            timestamp=timestamp,
            cycle=self.cycle
        )

        response = run_claude(prompt, cwd=str(IMPL_REPO), timeout=600)

        if not response:
            return None

        # レビュー結果を保存
        review_file = REVIEWS_DIR / f"review_cycle_{self.cycle:03d}.md"
        review_file.write_text(response, encoding='utf-8')

        append_log(f"### レビュー実行\n\n結果: {review_file}")

        # YAMLパース
        parsed = extract_yaml_from_response(response)

        if parsed and "review" in parsed:
            review = parsed["review"]
            gaps = (
                len(review.get("missing_in_impl", [])) +
                len(review.get("missing_in_requirements", [])) +
                len(review.get("mismatches", [])) +
                len(review.get("unclear", []))
            )
            return {
                "has_gaps": gaps > 0,
                "review": review,
                "raw": response
            }

        # パースできなくても差分ありとして続行
        has_gaps = "差分なし" not in response
        return {
            "has_gaps": has_gaps,
            "review": None,
            "raw": response
        }

    def _record_issues(self, review_result: dict) -> list:
        """Issue登録"""
        print("\n[Step 2] Issue登録")

        issues_data = load_yaml(ISSUES_FILE)
        existing_issues = issues_data.get("issues", [])
        existing_ids = {i.get("id") for i in existing_issues}

        new_issues = []
        review = review_result.get("review")

        if review:
            # 構造化されたレビュー結果からIssue抽出
            for gap in review.get("missing_in_impl", []):
                issue_id = gap.get("id", f"GAP-{len(existing_issues) + len(new_issues) + 1:03d}")
                if issue_id not in existing_ids:
                    new_issue = {
                        "id": issue_id,
                        "type": "missing_impl",
                        "title": gap.get("requirement", "未実装機能")[:100],
                        "location": gap.get("location", ""),
                        "severity": gap.get("severity", "medium"),
                        "status": "open",
                        "created_at": datetime.now().isoformat(),
                        "cycle": self.cycle
                    }
                    new_issues.append(new_issue)
                    existing_ids.add(issue_id)

            for item in review.get("unclear", []):
                issue_id = item.get("id", f"UNCLEAR-{len(existing_issues) + len(new_issues) + 1:03d}")
                if issue_id not in existing_ids:
                    new_issue = {
                        "id": issue_id,
                        "type": "unclear",
                        "title": item.get("description", "不明確な仕様")[:100],
                        "context": item.get("context", ""),
                        "status": "open",
                        "created_at": datetime.now().isoformat(),
                        "cycle": self.cycle
                    }
                    new_issues.append(new_issue)
                    existing_ids.add(issue_id)

        # 新規Issueを追加
        existing_issues.extend(new_issues)
        issues_data["issues"] = existing_issues
        save_yaml(ISSUES_FILE, issues_data)

        self.total_issues_created += len(new_issues)
        print(f"  新規Issue: {len(new_issues)}件")

        for issue in new_issues:
            print(f"    + {issue['id']}: {issue['title'][:50]}...")

        append_log(f"### Issue登録\n\n新規: {len(new_issues)}件\n\n" +
                   "\n".join([f"- {i['id']}: {i['title']}" for i in new_issues]))

        return new_issues

    def _investigate_issue(self, issue: dict):
        """PM調査"""
        print(f"\n[Step 3] PM調査: {issue['id']}")

        prompt = PM_PROMPT.format(
            issue=yaml.dump(issue, allow_unicode=True),
            issue_id=issue['id'],
            impl_repo=IMPL_REPO,
            requirements_file=REQUIREMENTS_FILE,
            timestamp=datetime.now().isoformat()
        )

        response = run_claude(prompt, cwd=str(IMPL_REPO), timeout=300)

        if not response:
            print(f"  [WARN] 調査失敗: {issue['id']}")
            return

        # 結果をパース
        parsed = extract_yaml_from_response(response)

        if parsed and "investigation" in parsed:
            inv = parsed["investigation"]

            # 決定事項があれば記録
            if "decision" in inv and inv["decision"]:
                dec = inv["decision"]
                dec_id = dec.get("id", f"DEC-{self.total_decisions_made + 1:03d}")

                # spec.yamlに追記
                spec = load_yaml(SPEC_FILE)
                spec[dec_id] = {
                    "what": dec.get("what", ""),
                    "value": dec.get("value", ""),
                    "reason": dec.get("reason", ""),
                    "related_issue": issue['id'],
                    "by": "PM",
                    "at": datetime.now().strftime("%Y-%m-%d")
                }
                save_yaml(SPEC_FILE, spec)

                # decisions.mdに追記
                content = f"""**Issue**: {issue['id']}

**決定事項**: {dec.get('what', '')}

**内容**: {dec.get('value', '')}

**理由**: {dec.get('reason', '')}
"""
                append_decision(dec_id, content)

                self.total_decisions_made += 1
                print(f"  + 決定: {dec_id}")

            # Issueステータス更新
            status = inv.get("status", "investigated")
            self._update_issue_status(issue['id'], status)

        append_log(f"### PM調査\n\nIssue: {issue['id']}\n\n{response[:500]}...")

    def _update_issue_status(self, issue_id: str, status: str):
        """Issueステータス更新"""
        issues_data = load_yaml(ISSUES_FILE)
        for issue in issues_data.get("issues", []):
            if issue.get("id") == issue_id:
                issue["status"] = status
                issue["updated_at"] = datetime.now().isoformat()
                break
        save_yaml(ISSUES_FILE, issues_data)

    def _final_report(self):
        """最終レポート"""
        print("\n" + "=" * 60)
        print("最終レポート")
        print("=" * 60)

        issues_data = load_yaml(ISSUES_FILE)
        spec = load_yaml(SPEC_FILE)

        all_issues = issues_data.get("issues", [])
        open_issues = [i for i in all_issues if i.get("status") == "open"]

        print(f"総サイクル数: {self.cycle}")
        print(f"Issue総数: {len(all_issues)}")
        print(f"  - Open: {len(open_issues)}")
        print(f"  - Resolved: {len(all_issues) - len(open_issues)}")
        print(f"決定事項: {len([k for k in spec.keys() if k.startswith('DEC-')])}")

        if open_issues:
            print("\n未解決Issue:")
            for issue in open_issues[:10]:
                print(f"  - {issue['id']}: {issue.get('title', '')[:50]}")

        # 最終レポートをログに記録
        append_log(f"""### 最終レポート

- サイクル: {self.cycle}
- Issue総数: {len(all_issues)}
- Open: {len(open_issues)}
- 決定事項: {len([k for k in spec.keys() if k.startswith('DEC-')])}
""")

# ============================================
# エントリーポイント
# ============================================

def main():
    # PyYAML確認
    try:
        import yaml
    except ImportError:
        print("ERROR: PyYAML が必要です")
        print("  pip install pyyaml")
        sys.exit(1)

    # claude CLI確認
    try:
        result = subprocess.run(["claude", "--version"], capture_output=True, text=True)
        print(f"Claude CLI: {result.stdout.strip()}")
    except FileNotFoundError:
        print("ERROR: claude CLI が見つかりません")
        print("  npm install -g @anthropic-ai/claude-code")
        sys.exit(1)

    # ディレクトリ確認
    if not IMPL_REPO.exists():
        print(f"ERROR: impl-repo が見つかりません: {IMPL_REPO}")
        sys.exit(1)

    if not REQUIREMENTS_FILE.exists():
        print(f"ERROR: 要件ファイルが見つかりません: {REQUIREMENTS_FILE}")
        sys.exit(1)

    # 実行
    orchestrator = DocumentationOrchestrator()
    orchestrator.run()

if __name__ == "__main__":
    main()
