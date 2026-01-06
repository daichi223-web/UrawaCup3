"""
ヘルスチェックエンドポイントのテスト
"""

import pytest
from fastapi.testclient import TestClient

import sys
sys.path.insert(0, str(__file__).replace("tests/backend/test_health.py", "src"))

from backend.main import app


@pytest.fixture
def client():
    """テスト用HTTPクライアント"""
    with TestClient(app) as c:
        yield c


class TestHealthEndpoint:
    """ヘルスチェックエンドポイントのテスト"""

    def test_health_check(self, client):
        """ヘルスチェックが正常に動作すること"""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_root_endpoint(self, client):
        """ルートエンドポイントが正常に動作すること"""
        response = client.get("/")
        assert response.status_code == 200
