"""
フェーズハンドラモジュール
"""

import json
from pathlib import Path
from datetime import datetime
from typing import TYPE_CHECKING

from .state import Phase, CycleState
from .agent import AgentRunner
from .utils import load_yaml, save_yaml, append_log

if TYPE_CHECKING:
    from .machine import StateMachine


class PhaseHandlers:
    """各フェーズの処理ハンドラ"""

    def __init__(self, doc_repo: Path, impl_repo: Path, agent: AgentRunner):
        self.doc_repo = doc_repo
        self.impl_repo = impl_repo
        self.agent = agent

    async def implement(self, state: CycleState) -> Phase:
        """わかるところだけ実装"""
        print("\n[IMPLEMENT] わかるところを実装")

        spec = load_yaml(self.doc_repo / "spec.yaml")

        result = await self.agent.run("implementer", f"""
以下のspecに基づいて実装してください。
確信が持てる部分のみ実装し、不明点は【不明】で報告。

## spec
```
{json.dumps(spec, ensure_ascii=False, indent=2)[:3000]}
```
""", self.impl_repo)

        state.impl_result = {
            "implemented": "【実装】" in result,
            "unknowns": result.count("【不明】"),
            "raw": result
        }

        append_log(self.doc_repo, f"[IMPLEMENT]\n{result}")

        return Phase.REVIEW

    async def review(self, state: CycleState) -> Phase:
        """要件との差分検出"""
        print("\n[REVIEW] 差分検出")

        req_file = self.doc_repo / "要件.md"
        req = req_file.read_text(encoding="utf-8") if req_file.exists() else ""
        spec = load_yaml(self.doc_repo / "spec.yaml")

        result = await self.agent.run("reviewer", f"""
要件と実装の差分を検出してください。

## 要件
```
{req[:2000]}
```

## spec
```
{json.dumps(spec, ensure_ascii=False, indent=2)[:1500]}
```

## 実装
{self.impl_repo} を確認してください。
""", self.impl_repo)

        has_diff = "【差分】" in result
        state.diff_result = {
            "has_diff": has_diff,
            "raw": result
        }

        append_log(self.doc_repo, f"[REVIEW]\n{result}")

        if has_diff:
            return Phase.ANALYZE
        else:
            issues = load_yaml(self.doc_repo / "issues.yaml")
            open_issues = [i for i in issues.get("issues", []) if i.get("status") == "open"]
            if open_issues:
                state.issues = open_issues
                return Phase.INVESTIGATE
            return Phase.DONE

    async def analyze(self, state: CycleState) -> Phase:
        """なぜズレたか検証"""
        print("\n[ANALYZE] 差分原因分析")

        result = await self.agent.run("analyzer", f"""
以下の差分がなぜ生じたか分析してください。

## 差分レポート
```
{state.diff_result.get('raw', '')[:2000]}
```

## 実装者の報告
```
{state.impl_result.get('raw', '')[:1500]}
```
""", self.impl_repo)

        state.analysis_result = {
            "raw": result,
            "causes": []
        }

        for line in result.split("\n"):
            if "原因:" in line:
                state.analysis_result["causes"].append(line.split("原因:")[1].strip())

        append_log(self.doc_repo, f"[ANALYZE]\n{result}")

        return Phase.EXTRACT

    async def extract(self, state: CycleState) -> Phase:
        """曖昧点抽出"""
        print("\n[EXTRACT] 曖昧点抽出")

        result = await self.agent.run("extractor", f"""
以下の分析から、要件として明確化すべき曖昧点を抽出してください。

## 分析結果
```
{state.analysis_result.get('raw', '')[:2000]}
```

## 差分
```
{state.diff_result.get('raw', '')[:1500]}
```
""", self.doc_repo)

        state.unknowns = []
        current_amb = {}
        for line in result.split("\n"):
            if "【曖昧点】" in line:
                if current_amb:
                    state.unknowns.append(current_amb)
                current_amb = {}
            elif "ID:" in line:
                current_amb["id"] = line.split("ID:")[1].strip()
            elif "質問:" in line:
                current_amb["question"] = line.split("質問:")[1].strip()
        if current_amb:
            state.unknowns.append(current_amb)

        append_log(self.doc_repo, f"[EXTRACT]\n{result}")

        if state.unknowns:
            return Phase.ISSUE
        else:
            return Phase.IMPLEMENT

    async def issue(self, state: CycleState) -> Phase:
        """Issue化"""
        print(f"\n[ISSUE] Issue登録: {len(state.unknowns)}件")

        issues = load_yaml(self.doc_repo / "issues.yaml")
        issues_list = issues.get("issues", [])

        existing_ids = [int(i["id"].split("-")[1]) for i in issues_list if i.get("id", "").startswith("ISSUE-")]
        max_id = max(existing_ids) if existing_ids else 0

        for amb in state.unknowns:
            max_id += 1
            issues_list.append({
                "id": f"ISSUE-{max_id:03d}",
                "title": amb.get("question", "不明"),
                "source_amb": amb.get("id", ""),
                "status": "open",
                "created_at": datetime.now().isoformat(),
                "cycle": state.cycle
            })

        issues["issues"] = issues_list
        save_yaml(self.doc_repo / "issues.yaml", issues)

        state.issues = [i for i in issues_list if i.get("status") == "open"]

        append_log(self.doc_repo, f"[ISSUE] {len(state.unknowns)}件登録")

        return Phase.INVESTIGATE

    async def investigate(self, state: CycleState) -> Phase:
        """調査"""
        print(f"\n[INVESTIGATE] 調査: {len(state.issues)}件")

        investigated = []
        for issue in state.issues[:5]:
            result = await self.agent.run("investigator", f"""
以下のIssueを調査してください。

## Issue
ID: {issue['id']}
質問: {issue['title']}

実装コード、コメント、命名規則から推測できることを報告。
""", self.impl_repo)

            investigated.append({
                "issue_id": issue["id"],
                "result": result,
                "confident": "確度: 確実" in result or "確度: 推測" in result
            })

        state.analysis_result["investigations"] = investigated

        append_log(self.doc_repo, f"[INVESTIGATE]\n{json.dumps(investigated, ensure_ascii=False, indent=2)[:2000]}")

        if any(i["confident"] for i in investigated):
            return Phase.DOCUMENT
        else:
            print("  [!] 全て不明。追加情報が必要。")
            return Phase.IMPLEMENT

    async def document(self, state: CycleState) -> Phase:
        """要件化"""
        print("\n[DOCUMENT] 要件化")

        investigations = state.analysis_result.get("investigations", [])

        for inv in investigations:
            if not inv.get("confident"):
                continue

            result = await self.agent.run("documenter", f"""
以下の調査結果を決定事項として文書化してください。

## Issue
{inv['issue_id']}

## 調査結果
```
{inv['result'][:1500]}
```
""", self.doc_repo)

            if "【決定】" in result:
                spec = load_yaml(self.doc_repo / "spec.yaml")
                decs = spec.get("decisions", {})

                existing_ids = [int(k.split("-")[1]) for k in decs.keys() if k.startswith("DEC-")]
                max_id = max(existing_ids) if existing_ids else 0
                max_id += 1
                dec_id = f"DEC-{max_id:03d}"

                decs[dec_id] = {
                    "issue": inv["issue_id"],
                    "content": result[:500],
                    "at": datetime.now().isoformat()
                }
                spec["decisions"] = decs
                save_yaml(self.doc_repo / "spec.yaml", spec)

                issues = load_yaml(self.doc_repo / "issues.yaml")
                for i in issues.get("issues", []):
                    if i["id"] == inv["issue_id"]:
                        i["status"] = "closed"
                        i["closed_by"] = dec_id
                save_yaml(self.doc_repo / "issues.yaml", issues)

                state.decisions.append({"id": dec_id, "issue": inv["issue_id"]})

        append_log(self.doc_repo, f"[DOCUMENT] {len(state.decisions)}件の決定")

        return Phase.IMPLEMENT
