#!/usr/bin/env python3
"""
浦和カップ実装オーケストレーター

coreモジュールを使用して浦和カップ トーナメント管理システムを実装する。

Usage:
    python run_urawacup.py                    # デフォルト設定で実行
    python run_urawacup.py --max-cycles 5     # 最大5サイクル
    python run_urawacup.py --timeout 600      # タイムアウト10分
"""

import asyncio
import argparse
from pathlib import Path

from core import StateMachine


async def main():
    parser = argparse.ArgumentParser(
        description="浦和カップ トーナメント管理システム 実装オーケストレーター"
    )
    parser.add_argument(
        "--max-cycles",
        type=int,
        default=50,
        help="最大サイクル数 (default: 50)"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="エージェントタイムアウト秒数 (default: 300)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="シミュレーションモードで実行"
    )

    args = parser.parse_args()

    # 固定パス
    doc_repo = Path("./doc-repo")
    impl_repo = Path("./impl-repo")

    print("=" * 60)
    print("浦和カップ トーナメント管理システム")
    print("実装オーケストレーター")
    print("=" * 60)
    print()
    print("doc-repo:", doc_repo.resolve())
    print("impl-repo:", impl_repo.resolve())
    print("max-cycles:", args.max_cycles)
    print("timeout:", args.timeout, "sec")
    print()

    # 要件ファイルの存在確認
    req_file = doc_repo / "要件.md"
    spec_file = doc_repo / "spec.yaml"

    if not req_file.exists():
        print(f"[ERROR] 要件ファイルが見つかりません: {req_file}")
        return

    if not spec_file.exists():
        print(f"[ERROR] specファイルが見つかりません: {spec_file}")
        return

    print("[OK] 要件ファイル確認完了")
    print()

    # StateMachine実行
    machine = StateMachine(
        doc_repo=doc_repo,
        impl_repo=impl_repo,
        max_cycles=args.max_cycles,
        timeout=args.timeout
    )

    await machine.run()


if __name__ == "__main__":
    try:
        import yaml
    except ImportError:
        print("[ERROR] PyYAML required: pip install pyyaml")
        exit(1)

    asyncio.run(main())
