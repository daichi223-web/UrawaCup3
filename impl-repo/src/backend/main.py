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

    # 初期データ投入（データベースが空の場合のみ）
    try:
        from .seed import seed_database
        seed_database()
    except Exception as e:
        logger.warning(f"Seed skipped or failed: {e}")

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

# CORS middleware
# ALLOWED_ORIGINS が "*" の場合は全オリジン許可
if ALLOWED_ORIGINS == ["*"] or "*" in ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # allow_origins=["*"] の場合は False にする必要がある
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
    from sqlalchemy import text

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
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


@app.post("/api/seed")
def run_seed():
    """
    初期データ投入エンドポイント（データベースが空の場合のみ）
    """
    from .database import SessionLocal
    from .models import Tournament, Team, Venue, User, Group, TeamType
    from passlib.context import CryptContext
    from datetime import date

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = SessionLocal()

    try:
        # 既存データチェック
        existing = db.query(Tournament).first()
        if existing:
            return {"message": "データベースに既にデータが存在します", "seeded": False}

        # 管理者ユーザー作成
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
        admin = User(
            username="admin",
            password_hash=pwd_context.hash(admin_password),
            display_name="管理者",
            role="admin",
            is_active=True
        )
        db.add(admin)

        # 大会作成
        tournament = Tournament(
            name="浦和カップ",
            year=2025,
            edition=1,
            start_date=date(2025, 3, 28),
            end_date=date(2025, 3, 30),
            match_duration=25,
            half_count=2
        )
        db.add(tournament)
        db.flush()

        # グループ作成
        for group_id in ["A", "B", "C", "D"]:
            group = Group(
                id=f"{tournament.id}_{group_id}",
                tournament_id=tournament.id,
                name=f"グループ{group_id}"
            )
            db.add(group)

        # 会場作成
        venues_data = [
            ("浦和駒場スタジアム", "駒場"),
            ("さいたま市浦和駒場第2グラウンド", "駒場第2"),
            ("浦和南高校", "浦和南"),
            ("浦和東高校", "浦和東"),
        ]
        for name, short_name in venues_data:
            venue = Venue(
                tournament_id=tournament.id,
                name=name,
                short_name=short_name
            )
            db.add(venue)

        # サンプルチーム作成
        teams_data = [
            ("A", "浦和南高校", "浦和南", "埼玉県", True),
            ("A", "前橋育英高校", "前橋育英", "群馬県", False),
            ("A", "國學院久我山高校", "國學院久我山", "東京都", False),
            ("A", "市立浦和高校", "市浦和", "埼玉県", False),
            ("B", "浦和東高校", "浦和東", "埼玉県", True),
            ("B", "青森山田高校", "青森山田", "青森県", False),
            ("B", "流通経済大柏高校", "流経柏", "千葉県", False),
            ("B", "川越南高校", "川越南", "埼玉県", False),
            ("C", "浦和西高校", "浦和西", "埼玉県", True),
            ("C", "静岡学園高校", "静岡学園", "静岡県", False),
            ("C", "昌平高校", "昌平", "埼玉県", False),
            ("C", "西武台高校", "西武台", "埼玉県", False),
            ("D", "浦和高校", "浦和", "埼玉県", True),
            ("D", "帝京高校", "帝京", "東京都", False),
            ("D", "正智深谷高校", "正智深谷", "埼玉県", False),
            ("D", "武南高校", "武南", "埼玉県", False),
        ]

        for i, (group_id, name, short_name, prefecture, is_host) in enumerate(teams_data):
            team = Team(
                tournament_id=tournament.id,
                group_id=group_id,
                group_order=i % 4 + 1,
                name=name,
                short_name=short_name,
                prefecture=prefecture,
                team_type=TeamType.local if prefecture == "埼玉県" else TeamType.invited,
                is_host=is_host
            )
            db.add(team)

        db.commit()
        return {
            "message": "初期データ投入完了",
            "seeded": True,
            "tournament_id": tournament.id,
            "teams": len(teams_data),
            "venues": len(venues_data)
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Seed failed: {e}")
        return {"error": str(e), "seeded": False}
    finally:
        db.close()


# 公開API（認証不要）
from .routes import public
app.include_router(public.router, prefix="/api/public", tags=["公開"])
