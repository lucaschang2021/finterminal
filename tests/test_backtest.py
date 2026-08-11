# -*- coding: utf-8 -*-
"""回测与行情缓存测试。"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import backtest as bt
import market_data as md


def test_backtest_buy_and_hold():
    df = pd.DataFrame({"收盘": np.linspace(100, 200, 100), "sig": 1})
    metrics, eq = bt.backtest(df, "sig", "收盘", initial_capital=100000, fee_rate=0.001)
    assert metrics["总收益率%"] > 90
    assert metrics["交易次数"] >= 1
    assert len(eq) == 100


def test_backtest_no_position():
    df = pd.DataFrame({"收盘": np.linspace(100, 200, 100), "sig": 0})
    metrics, _ = bt.backtest(df, "sig", "收盘")
    assert metrics["交易次数"] == 0
    assert metrics["总收益率%"] == 0


def test_backtest_insufficient_data():
    df = pd.DataFrame({"收盘": [1, 2], "sig": [1, 1]})
    try:
        bt.backtest(df, "sig", "收盘")
        assert False, "应抛出样本不足"
    except ValueError:
        pass


def test_market_cache():
    md._cache_set("quote:ut", {"现价": 1.0})
    assert md._cache_get("quote:ut", 30)["现价"] == 1.0
    assert md._cache_get("quote:ut", -1) is None


def test_indicators_extended():
    dates = pd.date_range("2026-01-01", periods=60, freq="D").strftime("%Y-%m-%d")
    close = np.linspace(100, 130, 60)
    df = pd.DataFrame({"日期": dates, "开盘": close - 1, "收盘": close,
                       "最高": close + 2, "最低": close - 2, "成交量": 1000})
    ind = md.indicators(df)
    for c in ("K", "D", "J", "OBV", "ATR"):
        assert c in ind.columns
