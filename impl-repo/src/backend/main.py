"""
UrawaCup Tournament Management System - FastAPI Application
"""

import os
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import engine, Base

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 環境変数
ENV = os.getenv("ENV", "development")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションライフサイクル"""
    # 起動時
    logger.info(f"Starting UrawaCup API in {ENV} mode")
    Base.metadata.create_all(bind=engine)
    yield
    # 終了時
    logger.info("Shutting down UrawaCup API")


app = FastAPI(
    title="UrawaCup Tournament Management System",
    description="浦和カップ トーナメント管理システム API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if ENV != "production" else None,
    redoc_url="/api/redoc" if ENV != "production" else None,
)

# CORS middleware（本番環境では許可オリジンを限定）
if ENV == "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ルーターをインポート・登録
from .routes import (
    auth,
    tournaments,
    teams,
    players,
    staff,
    venues,
    matches,
    standings,
    final_day,
    reports,
    reports_excel,
    exclusions,
)

app.include_router(auth.router, prefix="/api/auth", tags=["認証"])
app.include_router(tournaments.router, prefix="/api/tournaments", tags=["大会"])
app.include_router(teams.router, prefix="/api/teams", tags=["チーム"])
app.include_router(players.router, prefix="/api/players", tags=["選手"])
app.include_router(staff.router, prefix="/api/staff", tags=["スタッフ"])
app.include_router(venues.router, prefix="/api/venues", tags=["会場"])
app.include_router(matches.router, prefix="/api/matches", tags=["試合"])
app.include_router(standings.router, prefix="/api/standings", tags=["順位表"])
app.include_router(final_day.router, prefix="/api/final-day", tags=["最終日"])
app.include_router(reports.router, prefix="/api/reports", tags=["レポート"])
app.include_router(reports_excel.router, prefix="/api/reports/excel", tags=["Excel出力"])
app.include_router(exclusions.router, prefix="/api/exclusions", tags=["対戦除外"])


# グローバルエラーハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """グローバル例外ハンドラー"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "内部サーバーエラーが発生しました" if ENV == "production" else str(exc)
            }
        }
    )


@app.get("/")
def root():
    """ルートエンドポイント"""
    return {
        "message": "UrawaCup Tournament Management System API",
        "version": "1.0.0",
        "docs": "/api/docs" if ENV != "production" else None
    }


@app.get("/api/health")
def health_check():
    """
    ヘルスチェックエンドポイント

    監視システムからのポーリング用。
    データベース接続も確認する。
    """
    from .database import SessionLocal

    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "environment": ENV
    }


# 公開API（認証不要）
from .routes import public
app.include_router(public.router, prefix="/api/public", tags=["公開"])
