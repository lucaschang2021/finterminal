# -*- coding: utf-8 -*-
"""时序预测测试。"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import market_data as md


def _series():
    x = np.arange(120)
    return 100 + 0.5 * x + np.sin(x / 8) * 3


def test_forecast_models():
    y = _series()
    for model in ("linear", "arima", "ets", "auto"):
        fdf, info = md.forecast_model(y, 10, model)
        assert len(fdf) == 10, model
        assert {"期数", "预测收盘", "下界", "上界"} <= set(fdf.columns), model
        assert info.get("模型"), model


def test_forecast_short_series():
    fdf, info = md.forecast_model([1, 2, 3, 4], 5, "auto")
    assert len(fdf) == 5
    assert info["模型"] == "linear"


def test_forecast_unknown_model_fallback():
    fdf, info = md.forecast_model(_series(), 10, "nope")
    assert len(fdf) == 10 and info["模型"] == "linear"
