#!/usr/bin/env python3
"""
状態遷移型オーケストレーター

Usage:
    python state_orchestrator.py --max-cycles 10
    python state_orchestrator.py --doc-repo ./doc --impl-repo ./impl
"""

import asyncio
import argparse
from pathlib import Path

from core import StateMachine


async def main():
    parser = argparse.ArgumentParser(description="状態遷移型オーケストレーター")
    parser.add_argument("--max-cycles", type=int, default=20, help="最大サイクル数")
    parser.add_argument("--doc-repo", type=str, default="./doc-repo", help="doc-repoパス")
    parser.add_argument("--impl-repo", type=str, default="./impl-repo", help="impl-repoパス")
    parser.add_argument("--timeout", type=int, default=300, help="エージェントタイムアウト(秒)")

    args = parser.parse_args()

    machine = StateMachine(
        doc_repo=Path(args.doc_repo),
        impl_repo=Path(args.impl_repo),
        max_cycles=args.max_cycles,
        timeout=args.timeout
    )

    await machine.run()


if __name__ == "__main__":
    try:
        import yaml
    except ImportError:
        print("PyYAML required: pip install pyyaml")
        exit(1)

    asyncio.run(main())
