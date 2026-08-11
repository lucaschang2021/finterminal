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
    builtin = {"line","bar","barh","stacked_bar","grouped_bar","scatter","bubble","pie",
               "donut","area","candlestick","box","violin","histogram","heatmap","radar",
               "waterfall","funnel","step","polar","errorbar","treemap","scatter3d","surface",
               "technical","wordcloud","sankey"}
    assert builtin <= set(charts.supported_types())


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


def test_save_chart_generates_interactive_html(tmp_path, monkeypatch):
    """plot 保存时同时输出 PNG 与交互式 HTML（plotly 可用时）。"""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import mcp_server as m

    monkeypatch.setattr(m, "CHART_DIR", tmp_path)
    fig = charts.build_figure("line", _df(), x_column="x", y_column="y")
    result = m._save_chart(fig, "line")
    assert "交互图表" in result, result
    pngs = list(tmp_path.glob("*.png"))
    htmls = list(tmp_path.glob("*.html"))
    assert len(pngs) == 1 and len(htmls) == 1
    content = htmls[0].read_text(encoding="utf-8")
    assert "<html>" in content and "plotly" in content
