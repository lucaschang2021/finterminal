# -*- coding: utf-8 -*-
"""行情模块离线测试（不联网）。"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import market_data as md


def test_normalize_symbol():
    assert md._normalize_symbol("600519") == "sh600519"
    assert md._normalize_symbol("000858") == "sz000858"
    assert md._normalize_symbol("sh600519") == "sh600519"
    assert md._normalize_symbol("sz000858") == "sz000858"
    assert md._normalize_symbol("hk00700") == "hk00700"
    # 腾讯接口美股代码大小写敏感：前缀小写、ticker 保持大写
    assert md._normalize_symbol("usAAPL") == "usAAPL"
    assert md._normalize_symbol("usaapl") == "usAAPL"
    assert md._normalize_symbol("usMSFT") == "usMSFT"
    assert md._normalize_symbol("bj430047") == "bj430047"
    assert md._normalize_symbol("AAPL") == "shAAPL"  # 未识别前缀默认 sh，交由回退处理


def test_indicators():
    dates = pd.date_range("2026-01-01", periods=80, freq="D").strftime("%Y-%m-%d")
    close = np.linspace(100, 130, 80)
    df = pd.DataFrame({"日期": dates, "开盘": close - 1, "收盘": close,
                       "最高": close + 2, "最低": close - 2, "成交量": 1000})
    ind = md.indicators(df)
    for c in ("MA5", "MA20", "MA60", "DIF", "DEA", "MACD", "RSI", "BOLL上", "BOLL下"):
        assert c in ind.columns
    assert 0 <= ind["RSI"].dropna().max() <= 100


def test_forecast_from_df():
    dates = pd.date_range("2026-01-01", periods=60, freq="D").strftime("%Y-%m-%d")
    close = np.linspace(100, 120, 60)
    df = pd.DataFrame({"日期": dates, "开盘": close - 1, "收盘": close,
                       "最高": close + 2, "最低": close - 2, "成交量": 1000})
    fdf = md.forecast_from_df(df, 10)
    assert len(fdf) == 10
    assert {"预测收盘", "下界", "上界"} <= set(fdf.columns)
