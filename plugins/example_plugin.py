# -*- coding: utf-8 -*-
"""示例插件：演示数据源、分析类型与图表类型的扩展方式。
复制本文件改造即可接入自己的数据源或分析逻辑。"""

import pandas as pd


def register_plugin(ctx):
    # 数据源：查询代码为 DEMO 时返回演示行情/K线
    ctx.add_provider("quote", demo_quote)
    ctx.add_provider("kline", demo_kline)
    # 自定义分析类型：analyze(analysis="demo", ...)
    ctx.add_analysis("demo", demo_analysis)
    # 自定义图表类型：plot(chart_type="demo", ...)
    ctx.add_chart("demo", demo_chart)


def demo_quote(symbol):
    if symbol != "DEMO":
        return None
    return {"名称": "演示股票", "代码": "DEMO", "现价": 10.0, "昨收": 9.95,
            "涨跌幅%": 0.5, "成交量": 10000}


def demo_kline(symbol, days=60, period="daily"):
    if symbol != "DEMO":
        return None
    import numpy as np
    n = min(days, 30)
    return pd.DataFrame({
        "日期": pd.date_range("2026-01-01", periods=n).strftime("%Y-%m-%d"),
        "开盘": np.linspace(10, 12, n), "收盘": np.linspace(10, 12, n),
        "最高": np.linspace(10, 12.5, n), "最低": np.linspace(9.8, 11.8, n),
        "成交量": 1000,
    })


def demo_analysis(file_path, password=None):
    return "🧩 演示插件分析：这是一个由插件扩展的分析类型（demo）。"


def demo_chart(fig, df, params):
    ax = fig.add_subplot(111)
    ax.text(0.5, 0.5, "插件图表：demo", ha="center", va="center", fontsize=16)
    ax.axis("off")
