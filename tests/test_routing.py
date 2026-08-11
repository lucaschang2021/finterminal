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


def test_historical_report_query():
    """历史财报/研报类查询应直接走 RAG，而不是漏给通用 LLM。"""
    assert m._is_historical_report_query("茅台的历史财报") is True
    assert m._is_historical_report_query("茅台去年的年报") is True
    assert m._is_historical_report_query("茅台营收情况") is False      # 无历史时间意图
    assert m._is_historical_report_query("茅台现在多少钱") is False     # 实时意图
    assert m._is_historical_report_query("读一下茅台的历史财报文件") is False  # 文件读取不劫持
    assert m._is_historical_report_query("今天天气不错") is False


def test_ask_historical_report_routes_to_rag(tmp_path, monkeypatch):
    """端到端：ask('茅台的历史财报') 必须走 knowledge_fusion。"""
    sess = str(tmp_path / "session.json")
    monkeypatch.setattr(m, "SESSION_FILE", sess)
    calls = {}
    monkeypatch.setattr(m, "_market_quote", lambda s: calls.setdefault("quote", s))

    def fake_fusion(q, symbol=None, **k):
        calls["fusion"] = (q, symbol)
        return "FUSION"

    monkeypatch.setattr(m, "knowledge_fusion", fake_fusion)
    out = m.ask("茅台的历史财报")
    assert calls.get("fusion") == ("茅台的历史财报", "sh600519"), calls
    assert "FUSION" in out


def test_corrupt_session_fallback(tmp_path, monkeypatch):
    sess = str(tmp_path / "session.json")
    with open(sess, "w", encoding="utf-8") as f:
        f.write("{broken json")
    monkeypatch.setattr(m, "SESSION_FILE", sess)
    data = m.load_session()
    assert isinstance(data.get("last_search_results"), list)
    assert data.get("pending_market_query") is None


def test_detect_none():
    import mcp_server as m
    assert "请提供 path" in m.detect(None)


def test_parse_file_index_bare_digit():
    """文件选择支持裸数字（与行情歧义选择的风格一致），且不误伤其它数字。"""
    assert m._parse_file_index("1") == 0
    assert m._parse_file_index(" 2 ") == 1
    assert m._parse_file_index("第3个") == 2
    assert m._parse_file_index("文件4") == 3
    assert m._parse_file_index("2026年数据") is None
    assert m._parse_file_index("画折线图") is None


def test_research_agent_offline_degrades_gracefully(monkeypatch):
    """离线时 research_agent 逐章节降级：保留数据章节并标注，而不是整份失败。"""
    def fake_quote(symbol):
        raise RuntimeError("network down")

    def fake_kline(symbol, *a, **k):
        raise RuntimeError("network down")

    def fake_api_error():
        return None

    monkeypatch.setattr(m, "_api_key_error", fake_api_error)
    monkeypatch.setattr(m.market_data, "quote", fake_quote)
    monkeypatch.setattr(m.market_data, "kline", fake_kline)

    class FakeCompletions:
        def create(self, **kwargs):
            raise RuntimeError("network down")

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    monkeypatch.setattr(m.openai, "OpenAI", lambda *a, **k: FakeClient())
    out = m.research_agent("写一份贵州茅台的研究报告", save=False)
    assert isinstance(out, str) and out.strip()
    assert "投资研究报告" in out
    assert "（技术面不可用" in out
    assert "AI 综合结论不可用" in out
    assert "风险提示" in out
    assert not out.startswith("❌ 研究失败"), out[:200]
