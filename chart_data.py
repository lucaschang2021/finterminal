"""DataFrame → ECharts 结构化 option。

供 HTTP API 与前端使用：plot 工具生成 PNG/HTML 的同时，
本模块把同一份数据转成 ECharts 可直接消费的 option（JSON），
前端用 ECharts 做交互渲染（缩放/悬停/图例切换）。
"""

import pandas as pd

_SUPPORTED = ("line", "bar", "barh", "area", "stacked_bar", "grouped_bar",
              "scatter", "bubble", "pie", "donut", "box", "histogram")


def supported_types():
    return list(_SUPPORTED)


def _col(df, name, default=None):
    if not name:
        return default
    name = str(name).strip()
    return name if name in df.columns else default


def _num_list(df, col):
    out = []
    for v in df[col].tolist():
        out.append(None if pd.isna(v) else round(float(v), 6))
    return out


def _cats(df, col):
    return [str(v) for v in df[col].tolist()]


def _axis_series(chart_type, df, x_column, y_column, y_columns, title):
    """折线/柱状/面积/堆叠类：x 分类轴 + 一个或多个 y 序列。"""
    x = _col(df, x_column, str(df.columns[0]) if len(df.columns) else None)
    if not x:
        raise ValueError("缺少 x 轴列")
    ys = []
    if y_columns:
        ys = [c.strip() for c in str(y_columns).split(",") if c.strip() in df.columns]
    if y_column and str(y_column).strip() in df.columns:
        yc = str(y_column).strip()
        ys = [yc] + [c for c in ys if c != yc]
    if not ys:
        ys = [str(c) for c in df.columns if c != x and pd.api.types.is_numeric_dtype(df[c])][:4]
    if not ys and len(df.columns) > 1:
        ys = [str(df.columns[1])]
    if not ys:
        raise ValueError("缺少数值列")

    cats = _cats(df, x)
    etype = "bar" if chart_type in ("bar", "barh", "stacked_bar", "grouped_bar") else "line"
    series = []
    for y in ys:
        s = {"name": y, "type": etype, "data": _num_list(df, y)}
        if chart_type == "area":
            s["areaStyle"] = {}
        if chart_type == "stacked_bar":
            s["stack"] = "total"
        series.append(s)

    x_axis = {"type": "category", "data": cats, "name": x, "axisLabel": {"rotate": 30 if len(cats) > 12 else 0}}
    y_axis = {"type": "value"}
    if chart_type == "barh":
        x_axis, y_axis = y_axis, x_axis
        y_axis["name"] = x

    return {
        "title": {"text": title or f"{chart_type} - {x}"},
        "tooltip": {"trigger": "axis"},
        "legend": {"data": ys, "type": "scroll"},
        "grid": {"left": 60, "right": 30, "bottom": 60, "top": 60},
        "xAxis": x_axis,
        "yAxis": y_axis,
        "series": series,
    }


def build(chart_type, df, x_column=None, y_column=None, y_columns=None, value_column=None,
          title=None, **_ignored):
    """把 DataFrame 转成 {chart_type, option}；不支持的图表类型抛 ValueError。"""
    if chart_type not in _SUPPORTED:
        raise ValueError(f"暂不支持该图表类型的结构化数据: {chart_type}（支持 {', '.join(_SUPPORTED)}）")
    if df is None or df.empty:
        raise ValueError("数据为空，无法生成图表")

    if chart_type in ("line", "bar", "barh", "area", "stacked_bar", "grouped_bar"):
        return {"chart_type": chart_type, "option": _axis_series(chart_type, df, x_column, y_column, y_columns, title)}

    if chart_type in ("scatter", "bubble"):
        x = _col(df, x_column, str(df.columns[0]) if len(df.columns) else None)
        y = _col(df, y_column, next((c for c in df.columns if c != x and pd.api.types.is_numeric_dtype(df[c])), None))
        if not x or not y:
            raise ValueError("散点图需要 x_column 与 y_column")
        size = _col(df, value_column)
        s = {"name": y, "type": "scatter", "data": [[a, b] for a, b in zip(_cats(df, x), _num_list(df, y))]}
        if size:
            s["symbolSize"] = lambda v: 8 + abs(v[2]) / 10
        option = {
            "title": {"text": title or f"散点图 - {x} × {y}"},
            "tooltip": {},
            "grid": {"left": 60, "right": 30, "bottom": 60, "top": 60},
            "xAxis": {"type": "category", "data": _cats(df, x), "name": x},
            "yAxis": {"type": "value", "name": y},
            "series": [s],
        }
        return {"chart_type": chart_type, "option": option}

    if chart_type in ("pie", "donut"):
        name_col = _col(df, x_column, str(df.columns[0]))
        val_col = _col(df, value_column or y_column,
                       next((c for c in df.columns if c != name_col and pd.api.types.is_numeric_dtype(df[c])), None))
        if not name_col or not val_col:
            raise ValueError("饼图需要 x_column（名称）与 value_column（数值）")
        data = [{"name": n, "value": v} for n, v in zip(_cats(df, name_col), _num_list(df, val_col))
                if v is not None and v > 0]
        if not data:
            raise ValueError("饼图缺少正数值")
        radius = ["0%", "70%"] if chart_type == "donut" else "70%"
        option = {
            "title": {"text": title or f"饼图 - {val_col}", "left": "center"},
            "tooltip": {"trigger": "item"},
            "legend": {"type": "scroll", "bottom": 0},
            "series": [{"type": "pie", "radius": radius, "data": data,
                        "label": {"formatter": "{b}: {d}%"}}],
        }
        return {"chart_type": chart_type, "option": option}

    if chart_type == "box":
        nums = [str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        if not nums:
            raise ValueError("箱线图需要数值列")
        option = {
            "title": {"text": title or "箱线图"},
            "tooltip": {"trigger": "item"},
            "xAxis": {"type": "category", "data": nums},
            "yAxis": {"type": "value"},
            "series": [{"type": "boxplot", "data": [df[c].tolist() for c in nums]}],
        }
        return {"chart_type": chart_type, "option": option}

    if chart_type == "histogram":
        col = _col(df, y_column or value_column,
                   next((c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])), None))
        if not col:
            raise ValueError("直方图需要数值列")
        import numpy as np
        vals = df[col].dropna().tolist()
        counts, edges = np.histogram(vals, bins=min(20, max(5, int(len(vals) ** 0.5))))
        cats_h = [f"{edges[i]:.2f}~{edges[i+1]:.2f}" for i in range(len(edges) - 1)]
        option = {
            "title": {"text": title or f"直方图 - {col}"},
            "tooltip": {"trigger": "axis"},
            "grid": {"left": 60, "right": 30, "bottom": 60, "top": 60},
            "xAxis": {"type": "category", "data": cats_h, "axisLabel": {"rotate": 45}},
            "yAxis": {"type": "value", "name": "频数"},
            "series": [{"name": col, "type": "bar", "data": [int(c) for c in counts]}],
        }
        return {"chart_type": chart_type, "option": option}

    raise ValueError(f"暂不支持图表类型: {chart_type}")
