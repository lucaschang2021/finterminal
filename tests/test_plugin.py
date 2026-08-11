# -*- coding: utf-8 -*-
"""插件系统测试。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import plugin_manager


def test_plugins_loaded():
    assert plugin_manager.load_plugins() >= 1
    assert plugin_manager.get_providers("quote")
    assert plugin_manager.get_providers("kline")
    assert "demo" in plugin_manager.get_analyses()
    assert "demo" in plugin_manager.get_charts()


def test_plugin_provider():
    import market_data as md
    quote = md._plugin_call("quote", "DEMO")
    assert quote and quote.get("现价") == 10.0
    kdf = md._plugin_call("kline", "DEMO", 10, "daily")
    assert kdf is not None and len(kdf) == 10
    assert md._plugin_call("quote", "SH600519") is None  # 非 DEMO 由内置源处理
