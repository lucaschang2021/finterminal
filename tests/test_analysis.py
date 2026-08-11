# -*- coding: utf-8 -*-
"""统计分析模块测试。"""
import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import analysis as an


def test_describe():
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    out = an.describe(df)
    assert list(out["指标"]) == ["a"]
    assert float(out["均值"].iloc[0]) == pytest.approx(2.0)


def test_correlation_significance():
    df = pd.DataFrame({"x": np.arange(30) + 1, "y": (np.arange(30) + 1) * 2})
    r, p = an.correlation(df)
    assert abs(float(r.loc["x", "y"])) > 0.99
    assert float(p.loc["x", "y"]) < 0.001


def test_regression_robust_se():
    df = pd.DataFrame({"x": np.arange(20) + 1, "y": (np.arange(20) + 1) * 3 + 5})
    coef, summary = an.regression(df, "x", "y")
    assert abs(float(coef.loc[coef["变量"] == "x", "系数"].iloc[0]) - 3) < 0.01
    assert "稳健标准误" in coef.columns
    assert summary["R²"] > 0.99


def test_vif():
    rng = np.random.RandomState(1)
    a = np.arange(50) + 1
    df = pd.DataFrame({"a": a, "b": a * 2 + rng.normal(0, 1, 50), "c": rng.normal(0, 1, 50)})
    out = an.vif(df, "a,b,c")
    assert {"变量", "VIF", "判断"} <= set(out.columns)
    assert len(out) == 3


def test_nonparametric_tests():
    rng = np.random.RandomState(2)
    df = pd.DataFrame({"g": ["A"] * 20 + ["B"] * 20,
                       "v": list(rng.normal(0, 1, 20)) + list(rng.normal(0.8, 1, 20))})
    assert "Mann-Whitney" in an.stat_test(df, "g", "v", "mannwhitney")["检验"]
    assert "Kruskal" in an.stat_test(df, "g", "v", "kruskal")["检验"]


def test_event_study():
    dates = pd.date_range("2025-01-01", periods=40, freq="D")
    ret = pd.Series(np.random.RandomState(3).normal(0.001, 0.02, 40))
    ret[30:33] += 0.05
    df = pd.DataFrame({"日期": dates, "收益": ret})
    out, summary = an.event_study(df, "日期", "收益", "2025-01-31", window=(-3, 3))
    assert {"异常收益AR%", "累计异常收益CAR%"} <= set(out.columns)
    assert summary["窗口CAR%"] is not None


def test_did():
    df = pd.DataFrame({
        "outcome": [10, 11, 10, 11, 10, 11, 16, 17],
        "treat": [0, 0, 0, 0, 1, 1, 1, 1],
        "period": [0, 0, 1, 1, 0, 0, 1, 1],
    })
    coef, summary = an.did(df, "outcome", "treat", "period")
    assert abs(summary["DID估计量"] - 6.0) < 0.01
