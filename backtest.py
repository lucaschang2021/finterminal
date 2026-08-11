# -*- coding: utf-8 -*-
"""简单回测框架（FinTerminal）。

策略信号：signal_column 中 >0 表示持有多头，否则空仓（次日生效）。
输出绩效：总/年化收益率、最大回撤、夏普、交易次数、胜率。
"""

import numpy as np
import pandas as pd


def backtest(df, signal_column, price_column="收盘", initial_capital=100000.0, fee_rate=0.001):
    """执行回测，返回 (绩效指标 dict, 净值 DataFrame)。"""
    if signal_column not in df.columns or price_column not in df.columns:
        raise ValueError(f"列不存在（需要 {signal_column} 与 {price_column}）")
    data = df[[signal_column, price_column]].copy()
    data[signal_column] = pd.to_numeric(data[signal_column], errors="coerce").fillna(0)
    data[price_column] = pd.to_numeric(data[price_column], errors="coerce")
    data = data.dropna(subset=[price_column]).reset_index(drop=True)
    if len(data) < 5:
        raise ValueError("回测样本不足（至少 5 期）")

    signal = (data[signal_column] > 0).astype(int)
    position = signal.shift(1).fillna(0)  # 信号次日生效，避免前视偏差
    ret = data[price_column].pct_change().fillna(0)
    turnover = position.diff().abs().fillna(position.abs())
    strat_ret = position * ret - turnover * fee_rate

    equity = initial_capital * (1 + strat_ret).cumprod()
    total_return = equity.iloc[-1] / initial_capital - 1
    years = len(equity) / 252
    annual = (1 + total_return) ** (1 / years) - 1 if years > 0 and total_return > -1 else (total_return if years == 0 else -1)
    peak = equity.cummax()
    drawdown = (equity - peak) / peak
    max_dd = float(drawdown.min())
    std = float(strat_ret.std())
    sharpe = float(strat_ret.mean() / std * np.sqrt(252)) if std > 0 else 0.0
    active = strat_ret[strat_ret != 0]
    trades = int((position.diff().fillna(position.iloc[0]) != 0).sum())
    win_rate = float((active > 0).sum() / len(active)) if len(active) > 0 else 0.0

    metrics = {
        "总收益率%": round(total_return * 100, 2),
        "年化收益率%": round(annual * 100, 2),
        "最大回撤%": round(max_dd * 100, 2),
        "夏普比率": round(sharpe, 3),
        "交易次数": trades,
        "胜率%": round(win_rate * 100, 2),
        "期末净值": round(float(equity.iloc[-1]), 2),
    }
    bench = initial_capital * (1 + ret).cumprod()
    equity_df = pd.DataFrame({
        "期数": np.arange(1, len(equity) + 1),
        "策略净值": np.round(equity, 2),
        "买入持有净值": np.round(bench, 2),
    })
    return metrics, equity_df
