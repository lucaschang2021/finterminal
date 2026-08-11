# -*- coding: utf-8 -*-
"""意图路由与 session 测试。"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mcp_server as m


def test_time_intent():
    assert m._detect_time_intent("茅台现在多少钱") == "realtime"
    assert m._detect_time_intent("茅台历史财报") == "historical"
    assert m._detect_time_intent("分析一下茅台") is None


def test_market_extract():
    assert m._extract_market_symbol("茅台现在多少钱")[0] == "sh600519"
    assert m._extract_market_symbol("中国平安股价")[0] == "sh601318"
    assert m._extract_market_symbol("今天天气不错")[0] is None


def test_query_classification():
    assert m._is_research_query("写一份茅台的研究报告") is True
    assert m._is_research_query("把研报添加到知识库") is False
    assert m._is_market_query("茅台现在多少钱") is True
    assert m._is_vague_query("帮我看看这个") is True


def test_corrupt_session_fallback(tmp_path, monkeypatch):
    sess = str(tmp_path / "session.json")
    with open(sess, "w", encoding="utf-8") as f:
        f.write("{broken json")
    monkeypatch.setattr(m, "SESSION_FILE", sess)
    data = m.load_session()
    assert isinstance(data.get("last_search_results"), list)
    assert data.get("pending_market_query") is None
