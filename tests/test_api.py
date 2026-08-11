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
