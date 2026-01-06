"""
オーケストレーター実行スクリプト
"""
import asyncio
import logging
import sys
from pathlib import Path

# agentモジュールをインポートパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from agent import Orchestrator, OrchestratorConfig, RepoConfig, AgentConfig


def setup_logging():
    """ロギング設定"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


async def main():
    """メイン関数"""
    setup_logging()
    logger = logging.getLogger("main")

    # 設定
    config = OrchestratorConfig(
        doc_repo=RepoConfig(
            name="doc-repo",
            path=Path("D:/UrawaCup2/doc-repo"),
        ),
        impl_repo=RepoConfig(
            name="impl-repo",
            path=Path("D:/UrawaCup2/impl-repo"),
        ),
        agent=AgentConfig(
            model="claude-sonnet-4-20250514",
        ),
        max_cycles=10,
    )

    logger.info("=" * 60)
    logger.info("オーケストレーターエージェント起動")
    logger.info("=" * 60)
    logger.info(f"doc-repo: {config.doc_repo.path}")
    logger.info(f"impl-repo: {config.impl_repo.path}")
    logger.info("=" * 60)

    # オーケストレーター初期化
    orchestrator = Orchestrator(config)
    await orchestrator.initialize()

    # 1サイクル実行
    logger.info("単一サイクル実行中...")
    result = await orchestrator.run_single_cycle()

    # 結果表示
    logger.info("-" * 40)
    logger.info(f"サイクル結果: {result.status.value}")
    if result.task_id:
        logger.info(f"タスク: {result.task_id}")
    if result.error:
        logger.info(f"エラー: {result.error}")
    logger.info("-" * 40)

    # サマリー
    summary = orchestrator.get_summary()
    logger.info(f"完了タスク: {summary['total_completed']}")
    logger.info(f"失敗タスク: {summary['total_failed']}")


if __name__ == "__main__":
    asyncio.run(main())
