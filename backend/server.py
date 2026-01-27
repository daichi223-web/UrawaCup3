from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum
from fastapi.staticfiles import StaticFiles

from api.scheduling import endpoints as scheduling_endpoints
from api.venues import endpoints as venues_endpoints
from api.standings import endpoints as standings_endpoints
from api.reports import endpoints as reports_endpoints
from api.matches import endpoints as matches_endpoints

app = FastAPI(
    title="Urawa Cup Core API",
    description="PDF Generation, Schedule Service & New Format Tournament APIs",
    version="2.0.0"
)

app.include_router(scheduling_endpoints.router, tags=["scheduling"])
app.include_router(venues_endpoints.router, tags=["venues"])
app.include_router(standings_endpoints.router, tags=["standings"])
app.include_router(reports_endpoints.router, tags=["reports"])
app.include_router(matches_endpoints.router, tags=["matches"])

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://urawa-cup.vercel.app",
        "https://urawa-cup3.vercel.app",
        "https://urawacup3.vercel.app",
        "https://urawacup3-*.vercel.app",  # Preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount current directory for static files (html, css, js)
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/", summary="フロントエンド画面")
async def read_root():
    return FileResponse('index.html')

@app.get("/schedule", summary="最終日組み合わせ画面")
async def read_schedule():
    return FileResponse('final_day_schedule.html')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)