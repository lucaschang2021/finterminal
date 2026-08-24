import json

import pytest
from fastapi.testclient import TestClient

import api_server as api


@pytest.fixture
def client():
    return TestClient(api.app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["data"]["service"] == "FinTerminal"


def test_files(client, monkeypatch):
    monkeypatch.setattr(api.m, "list_files", lambda path: f"files:{path}")
    r = client.get("/api/files", params={"path": "."})
    assert r.json()["text"] == "files:."


def test_search(client, monkeypatch):
    monkeypatch.setattr(api.m, "search_file", lambda keyword, directory, recursive: "found")
    r = client.get("/api/search", params={"keyword": "abc"})
    assert r.json()["text"] == "found"


def test_detect(client, monkeypatch):
    monkeypatch.setattr(api.m, "detect", lambda path: "ok")
    r = client.get("/api/detect", params={"path": "x.csv"})
    assert r.json()["text"] == "ok"


def test_read(client, monkeypatch):
    monkeypatch.setattr(api.m, "read", lambda **kwargs: "read-ok")
    r = client.get("/api/read", params={"path": "x.csv"})
    assert r.json()["text"] == "read-ok"


def test_columns(client, monkeypatch):
    monkeypatch.setattr(api.m, "_detect_columns", lambda path: (["a", "b"], ["b"]))
    r = client.get("/api/columns", params={"path": "x.csv"})
    assert r.json()["data"] == {"columns": ["a", "b"], "numeric": ["b"]}


def test_clean(client, monkeypatch):
    monkeypatch.setattr(api.m, "clean", lambda *args, **kwargs: "clean-ok")
    r = client.post("/api/clean", json={"file_path": "x.csv"})
    assert r.json()["text"] == "clean-ok"


def test_analyze(client, monkeypatch):
    monkeypatch.setattr(api.m, "analyze", lambda *args, **kwargs: "analysis-ok")
    r = client.post("/api/analyze", json={"file_path": "x.csv"})
    assert r.json()["text"] == "analysis-ok"


def test_chain(client, monkeypatch):
    monkeypatch.setattr(api.m, "chain", lambda **kwargs: "chain-ok")
    r = client.get("/api/chain")
    assert r.json()["text"] == "chain-ok"


def test_ask(client, monkeypatch):
    monkeypatch.setattr(api.m, "_last_charts", [])
    monkeypatch.setattr(api.m, "ask", lambda query, history=None: "answer")
    r = client.post("/api/ask", json={"query": "hi"})
    assert r.json()["text"] == "answer"


def test_ask_stream_reports_progress_and_combined_artifacts(client, monkeypatch):
    """一次请求可同时返回图表和结构化统计成果，并保留最终文本帧。"""
    monkeypatch.setattr(api.m, "_last_charts", [])

    def fake_ask(query, history=None, event_callback=None):
        assert query == "画图并做统计"
        assert history == [{"role": "user", "content": "桌面上的数据"}]
        event_callback({"stage": "routing"})
        event_callback({"stage": "tool", "tool": "plot", "round": 1})
        api.m._last_charts.append("line_demo.png")
        event_callback({"stage": "tool_result", "tool": "plot", "round": 1, "result": "图表完成"})
        event_callback({"stage": "tool", "tool": "analyze", "round": 1})
        event_callback({"stage": "tool_result", "tool": "analyze", "round": 1, "result": "统计摘要"})
        return "图表与统计分析均已完成"

    monkeypatch.setattr(api.m, "ask_with_events", fake_ask)
    response = client.post(
        "/api/ask/stream",
        json={
            "query": "画图并做统计",
            "history": [{"role": "user", "content": "桌面上的数据"}],
        },
    )

    assert response.status_code == 200
    frames = [
        json.loads(line.removeprefix("data: "))
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
    stages = [frame.get("status", {}).get("stage") for frame in frames]
    assert "accepted" in stages
    assert "routing" in stages
    assert "tool" in stages
    assert "tool_complete" in stages
    assert "finalizing" in stages
    artifact_frames = [frame["artifacts"] for frame in frames if "artifacts" in frame]
    assert artifact_frames == [{
        "charts": ["line_demo.png"],
        "statistics": [{
            "analysis": "describe",
            "file_path": "",
            "result": "统计摘要",
        }],
    }]
    final_text = "".join(frame.get("delta", "") for frame in frames)
    assert "图表与统计分析均已完成" in final_text
    assert "charts/line_demo.png" in final_text
    assert any(frame.get("done") is True for frame in frames)


def test_cors_allows_electron_file_origin(client):
    r = client.options(
        "/api/health",
        headers={
            "Origin": "null",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"


def test_api_token_auth(monkeypatch):
    monkeypatch.setattr(api, "API_TOKEN", "secret-token")
    local_client = TestClient(api.app)

    unauthorized = local_client.get("/api/health")
    assert unauthorized.status_code == 401

    authorized = local_client.get(
        "/api/health",
        headers={"Authorization": "Bearer secret-token"},
    )
    assert authorized.status_code == 200


def test_api_token_query_parameter(monkeypatch):
    monkeypatch.setattr(api, "API_TOKEN", "secret-token")
    local_client = TestClient(api.app)
    r = local_client.get("/api/health?token=secret-token")
    assert r.status_code == 200
