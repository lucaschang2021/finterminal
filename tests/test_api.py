# -*- coding: utf-8 -*-
"""HTTP API 桥（api_server.py）回归测试。"""
import os
import sys

import pandas as pd
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import api_server as api


@pytest.fixture()
def client():
    return TestClient(api.app)


@pytest.fixture(autouse=True)
def _no_api_token():
    """默认关闭 API Token，保持各测试兼容；token 专项测试自行启用。"""
    old = api.API_TOKEN
    api.API_TOKEN = ""
    yield
    api.API_TOKEN = old


def _csv(tmp_path):
    p = str(tmp_path / "sales.csv")
    pd.DataFrame({"月份": [f"2026-{i:02d}" for i in range(1, 6)],
                  "销量": [10, 15, 20, 18, 25],
                  "销售额": [100, 150, 200, 180, 250]}).to_csv(p, index=False, encoding="utf-8-sig")
    return p


def test_health(client):
    r = client.get("/api/health").json()
    assert r["ok"] and r["data"]["tools"] == 8
    assert "line" in r["data"]["charts"]


def test_read_and_plot_data(client, tmp_path):
    p = _csv(tmp_path)
    r = client.get("/api/read", params={"path": p}).json()
    assert r["ok"] and "销售额" in r["text"]

    r = client.get("/api/plot/data", params={"chart_type": "line", "path": p,
                                             "x_column": "月份", "y_column": "销售额"}).json()
    assert r["ok"] and len(r["data"]["option"]["series"][0]["data"]) == 5


def test_plot_data_unsupported_type(client, tmp_path):
    p = _csv(tmp_path)
    r = client.get("/api/plot/data", params={"chart_type": "sankey", "path": p}).json()
    assert not r["ok"] and "暂不支持" in r["error"]


def test_chart_file_served_within_charts_dir(client, tmp_path, monkeypatch):
    """/api/file 只允许 charts/ 目录内，路径穿越必须 403。"""
    chart_dir = tmp_path / "charts"
    chart_dir.mkdir()
    (chart_dir / "ok.png").write_bytes(b"fake-png")
    monkeypatch.setattr(api, "CHART_DIR", chart_dir)

    r = client.get("/api/file", params={"path": "ok.png"})
    assert r.status_code == 200 and r.content == b"fake-png"

    r = client.get("/api/file", params={"path": "../../config.json"})
    assert r.status_code == 403


def test_ask_route(client):
    r = client.post("/api/ask", json={"query": "帮我看看这个"}).json()
    assert r["ok"] and ("没太理解" in r["text"] or "当前上下文" in r["text"])


def test_cors_allows_electron_file_origin(client):
    """Electron 生产模式（file:// 加载，Origin 为 null/file://）必须能跨域调用本地 API。"""
    r = client.get("/api/health", headers={"Origin": "null"})
    assert r.headers.get("access-control-allow-origin") == "*"
    r2 = client.get("/api/health", headers={"Origin": "file://"})
    assert r2.headers.get("access-control-allow-origin") == "*"


def test_api_key_save_clear(monkeypatch):
    """BYOK：保存到 keyring → 状态已配置 → 清除后未配置。"""
    import keyring
    import mcp_server as m

    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)  # 隔离环境变量（优先级最高）
    saved: dict = {}
    monkeypatch.setattr(keyring, "set_password", lambda s, u, k: saved.__setitem__(u, k))
    monkeypatch.setattr(keyring, "get_password", lambda s, u: saved.get(u))
    monkeypatch.setattr(keyring, "delete_password", lambda s, u: saved.pop(u, None))
    old = m.DEEPSEEK_API_KEY
    try:
        ok, msg = m.save_api_key("sk-test-123")
        assert ok and "已保存" in msg
        assert m.api_key_status()["configured"] is True
        assert m.api_key_status()["source"] == "Windows 凭据管理器"
        ok2, msg2 = m.clear_api_key()
        assert ok2 and "已清除" in msg2
        assert m.api_key_status()["configured"] is False
    finally:
        m.DEEPSEEK_API_KEY = old


def test_api_key_config_fallback(monkeypatch, tmp_path):
    """keyring 不可用时降级写入 config.json（保留其它字段）。"""
    import json
    import keyring
    import mcp_server as m

    def boom(*a, **k):
        raise RuntimeError("keyring unavailable")

    monkeypatch.setattr(keyring, "set_password", boom)
    cfg_file = tmp_path / "config.json"
    cfg_file.write_text('{"deepseek_model": "deepseek-v4-flash"}', encoding="utf-8")
    monkeypatch.setattr(m, "CONFIG_FILE", cfg_file)
    monkeypatch.setattr(m, "config", {"deepseek_model": "deepseek-v4-flash"})
    old = m.DEEPSEEK_API_KEY
    try:
        ok, msg = m.save_api_key("sk-fallback-1")
        assert ok and "config.json" in msg
        data = json.loads(cfg_file.read_text(encoding="utf-8"))
        assert data["deepseek_api_key"] == "sk-fallback-1"
        assert data["deepseek_model"] == "deepseek-v4-flash"  # 其它字段保留
    finally:
        m.DEEPSEEK_API_KEY = old


def test_api_key_endpoints(client, monkeypatch):
    """HTTP 端点：保存 → 状态 → 清除。"""
    import keyring

    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    saved: dict = {}
    monkeypatch.setattr(keyring, "set_password", lambda s, u, k: saved.__setitem__(u, k))
    monkeypatch.setattr(keyring, "get_password", lambda s, u: saved.get(u))
    monkeypatch.setattr(keyring, "delete_password", lambda s, u: saved.pop(u, None))
    import mcp_server as m
    old = m.DEEPSEEK_API_KEY
    try:
        r = client.post("/api/settings/api-key", json={"api_key": "sk-e2e"})
        assert r.json()["ok"]
        r = client.get("/api/settings/api-key/status")
        assert r.json()["data"]["configured"] is True
        r = client.delete("/api/settings/api-key")
        assert r.json()["ok"]
        assert client.get("/api/settings/api-key/status").json()["data"]["configured"] is False
    finally:
        m.DEEPSEEK_API_KEY = old


def test_api_token_required_when_enabled(client):
    """启用 FIN_API_TOKEN 后：无 token 401，错误 token 401，正确 token 放行。"""
    api.API_TOKEN = "secret-token-123"
    try:
        # 无 token
        r = client.get("/api/health")
        assert r.status_code == 401
        # 错误 token（query）
        r = client.get("/api/health", params={"token": "wrong"})
        assert r.status_code == 401
        # 错误 token（header）
        r = client.get("/api/health", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401
        # 正确 token（query）
        r = client.get("/api/health", params={"token": "secret-token-123"})
        assert r.status_code == 200 and r.json()["ok"]
        # 正确 token（header）
        r = client.get("/api/health", headers={"Authorization": "Bearer secret-token-123"})
        assert r.status_code == 200 and r.json()["ok"]
    finally:
        api.API_TOKEN = ""


def test_api_token_disabled_by_default(client):
    """未配置 FIN_API_TOKEN 时保持无鉴权（兼容开发模式）。"""
    assert api.API_TOKEN == ""
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"]
