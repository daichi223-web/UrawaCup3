"""
浦和カップ トーナメント管理システム - バックエンドAPI
FastAPI + SQLAlchemy
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import init_db, SessionLocal
from routes import api_router


def create_default_admin():
    """デフォルト管理者を作成（存在しない場合のみ）"""
    from models.user import User, UserRole
    from utils.auth import hash_password

    db = SessionLocal()
    try:
        # 管理者が存在するかチェック
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            # デフォルト管理者を作成
            admin = User(
                username="admin",
                password_hash=hash_password("admin1234"),
                display_name="システム管理者",
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("✓ デフォルト管理者を作成しました (admin / admin1234)")
        else:
            print("✓ 管理者ユーザーは既に存在します")
    except Exception as e:
        db.rollback()
        print(f"管理者作成エラー: {e}")
    finally:
        db.close()


def create_default_tournament():
    """デフォルト大会を作成（存在しない場合のみ）"""
    from models.tournament import Tournament
    from models.group import Group
    from datetime import date

    db = SessionLocal()
    try:
        # 大会が存在するかチェック
        tournament = db.query(Tournament).first()
        if not tournament:
            # デフォルト大会を作成
            tournament = Tournament(
                name="浦和カップ",
                edition=1,
                year=2025,
                start_date=date(2025, 3, 25),
                end_date=date(2025, 3, 28),
                match_duration=50,
                half_duration=10,
                interval_minutes=10,
            )
            db.add(tournament)
            db.flush()

            # グループを自動作成（A, B, C, D）
            group_names = {
                "A": "Aグループ（浦和南G）",
                "B": "Bグループ（市立浦和G）",
                "C": "Cグループ（浦和学院G）",
                "D": "Dグループ（武南G）",
            }
            for group_id, group_name in group_names.items():
                group = Group(
                    id=group_id,
                    tournament_id=tournament.id,
                    name=group_name,
                )
                db.add(group)

            db.commit()
            print("✓ デフォルト大会を作成しました (浦和カップ 2025)")
        else:
            print("✓ 大会は既に存在します")
    except Exception as e:
        db.rollback()
        print(f"大会作成エラー: {e}")
    finally:
        db.close()


def run_migrations():
    """新規カラムを既存テーブルに追加するマイグレーション"""
    from sqlalchemy import text, inspect

    db = SessionLocal()
    try:
        # tournamentsテーブルに新規カラムを追加
        inspector = inspect(db.bind)
        columns = [col['name'] for col in inspector.get_columns('tournaments')]

        migrations = []
        if 'group_count' not in columns:
            migrations.append("ALTER TABLE tournaments ADD COLUMN group_count INTEGER DEFAULT 4")
        if 'teams_per_group' not in columns:
            migrations.append("ALTER TABLE tournaments ADD COLUMN teams_per_group INTEGER DEFAULT 4")
        if 'advancing_teams' not in columns:
            migrations.append("ALTER TABLE tournaments ADD COLUMN advancing_teams INTEGER DEFAULT 1")

        for sql in migrations:
            try:
                db.execute(text(sql))
                print(f"✓ マイグレーション実行: {sql[:50]}...")
            except Exception as e:
                print(f"マイグレーションスキップ: {e}")

        db.commit()
        if migrations:
            print(f"✓ {len(migrations)}件のマイグレーションを実行しました")
    except Exception as e:
        print(f"マイグレーションエラー: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションのライフサイクル管理"""
    # 起動時の処理
    print("浦和カップ API サーバー起動中...")
    init_db()
    print("データベース初期化完了")
    run_migrations()
    create_default_admin()
    create_default_tournament()
    yield
    # 終了時の処理
    print("浦和カップ API サーバー終了")


# FastAPIアプリケーション作成
app = FastAPI(
    title="浦和カップ トーナメント管理システム API",
    description="さいたま市招待高校サッカーフェスティバル浦和カップの運営管理API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS設定
import os
cors_origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite開発サーバー
        "http://localhost:5174",  # Vite開発サーバー（代替ポート）
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "https://urawa-cup2.vercel.app",  # Vercel本番
        *cors_origins,  # 環境変数から追加
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # 全てのVercelプレビューURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# APIルーターを登録
app.include_router(api_router, prefix="/api")


# グローバルエラーハンドラ（デバッグ用）
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全ての例外をキャッチしてログ出力"""
    error_detail = traceback.format_exc()
    print(f"=== エラー発生 ===")
    print(f"URL: {request.url}")
    print(f"Method: {request.method}")
    print(f"Error: {exc}")
    print(f"Traceback:\n{error_detail}")
    print("==================")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )


@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "浦和カップ トーナメント管理システム API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}


# WebSocket setup
from fastapi import WebSocket, WebSocketDisconnect
from utils.websocket import manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # クライアントからのメッセージは現在は無視する（受信のみ）
            # keepaliveのために受信待ちを行う
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
