"""
WebSocket接続管理
"""

from typing import Dict, List, Set, Optional
from fastapi import WebSocket
import json
import asyncio
from datetime import datetime, timezone


class ConnectionManager:
    """WebSocket接続マネージャー"""

    def __init__(self):
        # tournament_id -> set of websocket connections
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # websocket -> tournament_id mapping for cleanup
        self.connection_tournament: Dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, tournament_id: int):
        """接続を受け入れる"""
        await websocket.accept()

        if tournament_id not in self.active_connections:
            self.active_connections[tournament_id] = set()

        self.active_connections[tournament_id].add(websocket)
        self.connection_tournament[websocket] = tournament_id

    def disconnect(self, websocket: WebSocket):
        """接続を切断"""
        tournament_id = self.connection_tournament.get(websocket)
        if tournament_id is not None:
            if tournament_id in self.active_connections:
                self.active_connections[tournament_id].discard(websocket)
                # 空になったらクリーンアップ
                if not self.active_connections[tournament_id]:
                    del self.active_connections[tournament_id]
            del self.connection_tournament[websocket]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """特定のクライアントにメッセージ送信"""
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

    async def broadcast_to_tournament(self, tournament_id: int, message: dict):
        """大会の全接続にブロードキャスト"""
        if tournament_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[tournament_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # 切断されたコネクションをクリーンアップ
        for conn in disconnected:
            self.disconnect(conn)

    async def send_match_update(self, tournament_id: int, match_id: int, data: dict):
        """試合更新通知"""
        message = {
            "type": "MATCH_UPDATE",
            "match_id": match_id,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.broadcast_to_tournament(tournament_id, message)

    async def send_standing_update(self, tournament_id: int, group_id: str, data: dict):
        """順位表更新通知"""
        message = {
            "type": "STANDING_UPDATE",
            "group_id": group_id,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.broadcast_to_tournament(tournament_id, message)

    async def send_approval_update(self, tournament_id: int, match_id: int, status: str):
        """承認状態更新通知"""
        message = {
            "type": "APPROVAL_UPDATE",
            "match_id": match_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.broadcast_to_tournament(tournament_id, message)

    async def send_match_locked(self, tournament_id: int, match_id: int, user_id: int, locked: bool):
        """試合ロック状態通知"""
        message = {
            "type": "MATCH_LOCKED",
            "match_id": match_id,
            "user_id": user_id,
            "locked": locked,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.broadcast_to_tournament(tournament_id, message)

    def get_connection_count(self, tournament_id: Optional[int] = None) -> int:
        """接続数を取得"""
        if tournament_id is not None:
            return len(self.active_connections.get(tournament_id, set()))
        return sum(len(conns) for conns in self.active_connections.values())


# グローバルインスタンス
manager = ConnectionManager()
