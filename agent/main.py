"""
オーケストレーターエージェント - メインエントリーポイント

使用方法:
    python -m agent.main --doc-repo ./doc-repo --impl-repo ./impl-repo
"""
import asyncio
import argparse
import logging
import sys
from pathlib import Path

from .orchestrator import Orchestrator, CycleStatus
from .config import OrchestratorConfig, RepoConfig, AgentConfig


def setup_logging(level: str = "INFO", log_file: Path | None = None):
    """ロギングを設定"""
    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )


def parse_args():
    """コマンドライン引数をパース"""
    parser = argparse.ArgumentParser(
        description="オーケストレーターエージェント - 開発サイクル自動化"
    )

    parser.add_argument(
        "--doc-repo",
        type=Path,
        default=Path("./doc-repo"),
        help="doc-repoのパス (default: ./doc-repo)",
    )

    parser.add_argument(
        "--impl-repo",
        type=Path,
        default=Path("./impl-repo"),
        help="impl-repoのパス (default: ./impl-repo)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default="claude-sonnet-4-20250514",
        help="使用するモデル (default: claude-sonnet-4-20250514)",
    )

    parser.add_argument(
        "--max-cycles",
        type=int,
        default=100,
        help="最大サイクル数 (default: 100)",
    )

    parser.add_argument(
        "--single-cycle",
        action="store_true",
        help="1サイクルのみ実行",
    )

    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="ログレベル (default: INFO)",
    )

    parser.add_argument(
        "--log-file",
        type=Path,
        default=None,
        help="ログファイルパス",
    )

    return parser.parse_args()


async def main():
    """メイン関数"""
    args = parse_args()

    # ロギング設定
    setup_logging(args.log_level, args.log_file)
    logger = logging.getLogger("main")

    # 設定を構築
    config = OrchestratorConfig(
        doc_repo=RepoConfig(
            name="doc-repo",
            path=args.doc_repo,
        ),
        impl_repo=RepoConfig(
            name="impl-repo",
            path=args.impl_repo,
        ),
        agent=AgentConfig(
            model=args.model,
        ),
        max_cycles=args.max_cycles,
        log_level=args.log_level,
        log_file=args.log_file,
    )

    logger.info("=" * 60)
    logger.info("オーケストレーターエージェント起動")
    logger.info("=" * 60)
    logger.info(f"doc-repo: {config.doc_repo.path}")
    logger.info(f"impl-repo: {config.impl_repo.path}")
    logger.info(f"model: {config.agent.model}")
    logger.info(f"max_cycles: {config.max_cycles}")
    logger.info("=" * 60)

    # オーケストレーター初期化
    orchestrator = Orchestrator(config)
    await orchestrator.initialize()

    try:
        if args.single_cycle:
            # 1サイクルのみ実行
            logger.info("単一サイクルモードで実行")
            result = await orchestrator.run_single_cycle()
            print_cycle_result(result)
        else:
            # フルサイクル実行
            logger.info("フルサイクルモードで実行")
            results = await orchestrator.run()

            # 結果サマリー
            print_summary(orchestrator, results)

    except KeyboardInterrupt:
        logger.info("ユーザーによる中断")
    except Exception as e:
        logger.error(f"エラー発生: {e}")
        raise


def print_cycle_result(result):
    """サイクル結果を表示"""
    print("\n" + "=" * 40)
    print(f"サイクル {result.cycle_number} 結果")
    print("=" * 40)
    print(f"ステータス: {result.status.value}")
    if result.task_id:
        print(f"タスクID: {result.task_id}")
        print(f"タスク名: {result.task_title}")
    if result.error:
        print(f"エラー: {result.error}")
    print("=" * 40 + "\n")


def print_summary(orchestrator, results):
    """サマリーを表示"""
    summary = orchestrator.get_summary()

    print("\n" + "=" * 60)
    print("実行サマリー")
    print("=" * 60)
    print(f"総サイクル数: {summary['current_cycle']}")
    print(f"成功タスク数: {summary['total_completed']}")
    print(f"失敗タスク数: {summary['total_failed']}")
    print(f"成功率: {summary['success_rate']:.1f}%")

    if summary['last_error']:
        print(f"最後のエラー: {summary['last_error']}")

    print("\n各サイクルの結果:")
    for result in results:
        status_icon = "✓" if result.status == CycleStatus.COMPLETED else "✗"
        task_info = f" - {result.task_title}" if result.task_title else ""
        print(f"  [{status_icon}] サイクル {result.cycle_number}{task_info}")

    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
