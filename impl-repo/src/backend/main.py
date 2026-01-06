"""
浦和カップ トーナメント管理システム - FastAPI アプリケーション
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from .database import init_db
from .schemas.error import ErrorResponse, ErrorDetail
from .utils.websocket import manager

# CORS設定（環境変数から取得、デフォルトは開発環境用）
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーション起動時にDBを初期化"""
    init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="浦和カップ API",
    description="浦和カップ トーナメント管理システム API",
    version="1.0.0"
)

# CORS設定（本番環境では ALLOWED_ORIGINS 環境変数を設定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


# 例外ハンドラ - 統一されたエラーレスポンス形式
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTPExceptionを統一形式で返す"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetail(
                code=f"HTTP_{exc.status_code}",
                message=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
                details=None
            )
        ).model_dump()
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """ValidationErrorを統一形式で返す"""
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error=ErrorDetail(
                code="VALIDATION_ERROR",
                message="リクエストのバリデーションに失敗しました",
                details=exc.errors()
            )
        ).model_dump()
    )


@app.get("/")
async def root():
    return {"message": "浦和カップ API", "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, tournament_id: int = 0):
    """
    WebSocket接続エンドポイント
    - リアルタイム更新通知を受信
    - tournament_idで購読する大会を指定
    """
    # tournament_idが0の場合は全大会を購読（デフォルト）
    if tournament_id == 0:
        tournament_id = 1  # デフォルト大会

    await manager.connect(websocket, tournament_id)
    try:
        while True:
            # クライアントからのメッセージを待機（ハートビート用）
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ルーター登録
from .routes import (
    tournaments_router,
    teams_router,
    matches_router,
    standings_router,
    players_router,
    venues_router,
    staff_router,
    auth_router,
    exclusions_router,
    final_day_router,
    reports_router,
    reports_excel_router,
)

app.include_router(auth_router, prefix="/api/auth", tags=["認証"])
app.include_router(tournaments_router, prefix="/api/tournaments", tags=["大会"])
app.include_router(teams_router, prefix="/api/teams", tags=["チーム"])
app.include_router(players_router, prefix="/api/players", tags=["選手"])
app.include_router(matches_router, prefix="/api/matches", tags=["試合"])
app.include_router(standings_router, prefix="/api/standings", tags=["順位表"])
app.include_router(venues_router, prefix="/api/venues", tags=["会場"])
app.include_router(staff_router, prefix="/api/staff", tags=["スタッフ"])
app.include_router(exclusions_router, prefix="/api/exclusions", tags=["対戦除外設定"])
app.include_router(final_day_router, prefix="/api", tags=["最終日"])
app.include_router(reports_router, prefix="/api/reports", tags=["レポート"])
app.include_router(reports_excel_router, prefix="/api/reports", tags=["レポートExcel"])
