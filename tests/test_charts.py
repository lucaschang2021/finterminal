# -*- coding: utf-8 -*-
"""图表模块测试。"""
import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import charts


def _df():
    return pd.DataFrame({"x": ["a", "b", "c"], "y": [1, 2, 3]})


def test_supported_types():
    assert len(charts.supported_types()) == 27


@pytest.mark.parametrize("ctype", ["line", "bar", "pie", "scatter", "area", "step", "polar", "radar", "waterfall", "funnel", "treemap"])
def test_basic_charts(ctype):
    fig = charts.build_figure(ctype, _df(), x_column="x", y_column="y")
    assert fig is not None


def test_candlestick_and_technical():
    df = pd.DataFrame({
        "日期": pd.date_range("2026-01-01", periods=30, freq="D").strftime("%Y-%m-%d"),
        "开盘": np.linspace(10, 20, 30), "收盘": np.linspace(11, 21, 30),
        "最高": np.linspace(12, 22, 30), "最低": np.linspace(9, 19, 30), "成交量": 1000,
    })
    charts.build_figure("candlestick", df, x_column="日期", open_column="开盘",
                        high_column="最高", low_column="最低", close_column="收盘")
    ind = df.copy()
    for c in ("MA5", "MA20", "BOLL上", "BOLL下", "RSI"):
        ind[c] = 10
    charts.build_figure("technical", ind, x_column="日期")


def test_missing_column_error():
    with pytest.raises(ValueError, match="缺少"):
        charts.build_figure("line", _df(), x_column="不存在", y_column="y")


def test_unknown_type_error():
    with pytest.raises(ValueError, match="不支持的图表类型"):
        charts.build_figure("nope", _df())
