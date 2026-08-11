# -*- coding: utf-8 -*-
"""
图表模块（FinTerminal）
======================
统一的图表绘制入口 build_figure()，按 chart_type 分派到 24 种图表实现。

支持类型：
line / bar / barh / stacked_bar / grouped_bar / scatter / bubble / pie / donut /
area / candlestick / box / violin / histogram / heatmap / radar / waterfall /
funnel / step / polar / errorbar / treemap / scatter3d / surface

所有实现均为纯 matplotlib（treemap 需要 squarify），
中文标题由项目统一的字体配置保证。
"""

import numpy as np
import os


class _LazyPandas:
    _m = None

    def __getattr__(self, name):
        if self._m is None:
            import pandas as _pd
            self._m = _pd
        return getattr(self._m, name)


pd = _LazyPandas()


class _LazyPlt:
    """惰性加载 matplotlib.pyplot：首次绘图才导入（含中文字体配置），加快服务启动。"""
    _m = None

    def __getattr__(self, name):
        if self._m is None:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as _plt
            _plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei", "Arial Unicode MS"]
            _plt.rcParams["axes.unicode_minus"] = False
            self._m = _plt
        return getattr(self._m, name)


plt = _LazyPlt()



# ==================== 工具函数 ====================

def _num(df, col):
    """转数值列，非数值转 NaN。"""
    return pd.to_numeric(df[col], errors="coerce")


def _need(df, col, what):
    """校验列存在，否则抛出友好错误。"""
    if not col or col not in df.columns:
        available = ", ".join(str(c) for c in df.columns)
        raise ValueError(f"缺少{what}列: {col or '未指定'}，可用列: {available}")


def _labels(ax, df, x_col, tick_step=None):
    """设置分类横轴刻度（行数多时抽样）。"""
    n = len(df)
    if tick_step:
        idx = list(range(0, n, tick_step))
    elif n > 1000:
        idx = list(range(0, n, max(1, n // 20)))
    else:
        idx = list(range(n))
    # 只转换抽样到的标签，避免大文件全量 astype
    labels = [str(df[x_col].iloc[i]) for i in idx]
    ax.set_xticks(idx)
    ax.set_xticklabels(labels, rotation=45, ha="right")


def _title(ax, params, default):
    ax.set_title(params.get("title") or default)


# ==================== 2D 图表实现 ====================

def _line(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴")
    ax.plot(range(len(df)), _num(df, p["y"]), marker="o", linewidth=2)
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 20))
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "折线图")


def _bar(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴")
    ax.bar(range(len(df)), _num(df, p["y"]))
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 20))
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "柱状图")


def _barh(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "分类"); _need(df, p["y"], "数值")
    ax.barh(range(len(df)), _num(df, p["y"]))
    ax.set_yticks(range(len(df)))
    ax.set_yticklabels(df[p["x"]].astype(str), fontsize=9)
    ax.set_xlabel(p["y"]); ax.grid(True, alpha=0.3, axis="x")
    _title(ax, p, "水平柱状图")


def _stacked_bar(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴")
    if len(p["y_cols"]) < 2:
        raise ValueError("堆叠柱状图需要至少 2 个数值列（y_columns，逗号分隔）")
    bottom = np.zeros(len(df))
    for col in p["y_cols"]:
        _need(df, col, "数值")
        vals = _num(df, col).fillna(0)
        ax.bar(range(len(df)), vals, bottom=bottom, label=col)
        bottom += vals.values
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 20))
    ax.legend(); ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "堆叠柱状图")


def _grouped_bar(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴")
    if len(p["y_cols"]) < 2:
        raise ValueError("分组柱状图需要至少 2 个数值列（y_columns，逗号分隔）")
    n = len(df); width = 0.8 / len(p["y_cols"])
    for i, col in enumerate(p["y_cols"]):
        _need(df, col, "数值")
        ax.bar(np.arange(n) + i * width, _num(df, col), width=width, label=col)
    ax.set_xticks(np.arange(n) + width * (len(p["y_cols"]) - 1) / 2)
    ax.set_xticklabels(df[p["x"]].astype(str), rotation=45, ha="right", fontsize=9)
    ax.legend(); ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "分组柱状图")


def _scatter(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴")
    xs, ys = _num(df, p["x"]), _num(df, p["y"])
    if xs.notna().any() and ys.notna().any():
        ax.scatter(xs, ys, s=60, alpha=0.7)
    else:
        ax.scatter(range(len(df)), ys, s=60, alpha=0.7)
        _labels(ax, df, p["x"])
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "散点图")


def _bubble(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴"); _need(df, p["size"], "气泡大小")
    sizes = _num(df, p["size"]).fillna(0)
    scale = 800 / max(float(sizes.max()), 1) if len(df) else 1
    ax.scatter(_num(df, p["x"]), _num(df, p["y"]), s=sizes * scale, alpha=0.6)
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "气泡图（大小=" + p["size"] + "）")


def _pie(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "分类"); _need(df, p["y"], "数值")
    data = pd.DataFrame({"label": df[p["x"]].astype(str), "val": _num(df, p["y"])}).dropna()
    data = data.sort_values("val", ascending=False)
    if len(data) > 10:
        top = data.head(9)
        other = pd.DataFrame({"label": ["其他"], "val": [data["val"].iloc[9:].sum()]})
        data = pd.concat([top, other], ignore_index=True)
    ax.pie(data["val"], labels=data["label"], autopct="%1.1f%%", startangle=90,
           counterclock=False, textprops={"fontsize": 9})
    ax.axis("equal")
    _title(ax, p, "饼图")


def _donut(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "分类"); _need(df, p["y"], "数值")
    data = pd.DataFrame({"label": df[p["x"]].astype(str), "val": _num(df, p["y"])}).dropna()
    if len(data) > 10:
        data = data.sort_values("val", ascending=False)
        top = data.head(9)
        other = pd.DataFrame({"label": ["其他"], "val": [data["val"].iloc[9:].sum()]})
        data = pd.concat([top, other], ignore_index=True)
    wedges, _ = ax.pie(data["val"], labels=data["label"], startangle=90,
                       counterclock=False, textprops={"fontsize": 9}, wedgeprops={"width": 0.35})
    ax.axis("equal")
    _title(ax, p, "环形图")


def _area(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴")
    vals = _num(df, p["y"]).fillna(0)
    ax.fill_between(range(len(df)), vals, alpha=0.35)
    ax.plot(range(len(df)), vals, linewidth=2)
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 20))
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "面积图")


def _candlestick(fig, df, p):
    ax = fig.add_subplot(111)
    for c, name in (("open", "开盘"), ("high", "最高"), ("low", "最低"), ("close", "收盘")):
        _need(df, p[c], name)
    if len(df) > 250:
        df = df.tail(250).reset_index(drop=True)  # 大文件只画最近 250 根，保证性能
    op = _num(df, p["open"]); hi = _num(df, p["high"])
    lo = _num(df, p["low"]); cl = _num(df, p["close"])
    width = 0.6
    for i in range(len(df)):
        up = cl.iloc[i] >= op.iloc[i]
        color = "#e53935" if up else "#26a69a"  # 中国习惯：红涨绿跌
        ax.plot([i, i], [lo.iloc[i], hi.iloc[i]], color=color, linewidth=1)
        bottom, height = (op.iloc[i], cl.iloc[i] - op.iloc[i]) if up else (cl.iloc[i], op.iloc[i] - cl.iloc[i])
        ax.add_patch(plt.Rectangle((i - width / 2, bottom), width, max(height, 1e-9),
                                   facecolor=color, edgecolor=color))
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 15))
    ax.set_xlabel(p["x"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "K线图")


def _box(fig, df, p):
    ax = fig.add_subplot(111)
    cols = p["y_cols"] or ([p["y"]] if p["y"] else [])
    if not cols:
        raise ValueError("箱线图需要指定 y_column 或 y_columns")
    data = [_num(df, c).dropna().tolist() for c in cols]
    ax.boxplot(data, patch_artist=True)
    ax.set_xticks(range(1, len(cols) + 1))
    ax.set_xticklabels(cols)
    ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "箱线图")


def _violin(fig, df, p):
    ax = fig.add_subplot(111)
    cols = p["y_cols"] or ([p["y"]] if p["y"] else [])
    if not cols:
        raise ValueError("小提琴图需要指定 y_column 或 y_columns")
    data = [_num(df, c).dropna().tolist() for c in cols]
    ax.violinplot(data, showmedians=True)
    ax.set_xticks(range(1, len(cols) + 1))
    ax.set_xticklabels(cols)
    ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "小提琴图")


def _histogram(fig, df, p):
    ax = fig.add_subplot(111)
    col = p["y"] or p["x"]
    _need(df, col, "数值")
    vals = _num(df, col).dropna()
    ax.hist(vals, bins=min(30, max(10, int(np.sqrt(len(vals))))), edgecolor="white", alpha=0.8)
    ax.set_xlabel(col); ax.set_ylabel("频数"); ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "直方图")


def _heatmap(fig, df, p):
    ax = fig.add_subplot(111)
    if p["value"] and p["x"] and p["y"]:
        _need(df, p["value"], "数值"); _need(df, p["x"], "行"); _need(df, p["y"], "列")
        pivot = df.pivot_table(index=p["x"], columns=p["y"], values=p["value"], aggfunc="mean")
        data = pivot.values
        row_labels = [str(i) for i in pivot.index]
        col_labels = [str(c) for c in pivot.columns]
        im = ax.imshow(data, aspect="auto", cmap="YlOrRd")
        ax.set_xticks(range(len(col_labels))); ax.set_xticklabels(col_labels, rotation=45, ha="right", fontsize=8)
        ax.set_yticks(range(len(row_labels))); ax.set_yticklabels(row_labels, fontsize=8)
        fig.colorbar(im, ax=ax, shrink=0.8)
    else:
        num_df = df.select_dtypes(include=[np.number])
        if num_df.shape[1] < 2:
            raise ValueError("热力图需要：指定 x/y/value 三列做透视，或至少 2 个数值列做相关性热图")
        data = num_df.corr().values
        labels = [str(c) for c in num_df.columns]
        im = ax.imshow(data, cmap="coolwarm", vmin=-1, vmax=1)
        ax.set_xticks(range(len(labels))); ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8)
        ax.set_yticks(range(len(labels))); ax.set_yticklabels(labels, fontsize=8)
        fig.colorbar(im, ax=ax, shrink=0.8)
    _title(ax, p, "热力图")


def _radar(fig, df, p):
    _need(df, p["x"], "分类")
    series = p["y_cols"] or ([p["y"]] if p["y"] else [])
    if not series:
        raise ValueError("雷达图需要指定 y_column 或 y_columns")
    cats = df[p["x"]].astype(str).tolist()
    n = len(cats)
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    angles += angles[:1]
    ax = fig.add_subplot(111, projection="polar")
    for col in series:
        _need(df, col, "数值")
        vals = _num(df, col).fillna(0).tolist()
        vals += vals[:1]
        ax.plot(angles, vals, label=col, linewidth=2)
        ax.fill(angles, vals, alpha=0.15)
    ax.set_xticks(angles[:-1]); ax.set_xticklabels(cats, fontsize=8)
    ax.legend(loc="upper right", bbox_to_anchor=(1.2, 1.1))
    _title(ax, p, "雷达图")


def _waterfall(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "分类"); _need(df, p["y"], "数值")
    vals = _num(df, p["y"]).fillna(0).tolist()
    running = [0.0]
    for v in vals:
        running.append(running[-1] + v)
    for i in range(len(vals)):
        color = "#e53935" if vals[i] >= 0 else "#26a69a"
        ax.bar(i, abs(vals[i]), bottom=min(running[i], running[i + 1]), color=color, alpha=0.85)
    ax.plot(range(len(vals) + 1), running, marker="o", color="#37474f", linewidth=2)
    ax.axhline(0, color="gray", linewidth=1)
    ax.set_xticks(range(len(vals)))
    ax.set_xticklabels(df[p["x"]].astype(str), rotation=45, ha="right", fontsize=9)
    ax.grid(True, alpha=0.3, axis="y")
    _title(ax, p, "瀑布图")


def _funnel(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "阶段"); _need(df, p["y"], "数值")
    data = pd.DataFrame({"stage": df[p["x"]].astype(str), "val": _num(df, p["y"])}).dropna()
    data = data.sort_values("val", ascending=False).reset_index(drop=True)
    vals = data["val"].tolist()
    ax.barh(range(len(data)), vals, color=plt.cm.Blues(np.linspace(0.35, 0.95, len(data))))
    ax.set_yticks(range(len(data))); ax.set_yticklabels(data["stage"], fontsize=9)
    for i, v in enumerate(vals):
        ax.text(v, i, f" {v:.0f}", va="center", fontsize=9)
    ax.grid(True, alpha=0.3, axis="x")
    _title(ax, p, "漏斗图")


def _step(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴")
    ax.step(range(len(df)), _num(df, p["y"]), where="mid", linewidth=2)
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 20))
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "步进图")


def _polar(fig, df, p):
    _need(df, p["x"], "角度分类"); _need(df, p["y"], "数值")
    vals = _num(df, p["y"]).fillna(0).tolist()
    n = len(vals)
    theta = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    ax = fig.add_subplot(111, projection="polar")
    ax.plot(theta + theta[:1], vals + vals[:1], marker="o", linewidth=2)
    ax.fill(theta + theta[:1], vals + vals[:1], alpha=0.2)
    ax.set_xticks(theta); ax.set_xticklabels(df[p["x"]].astype(str), fontsize=7)
    _title(ax, p, "极坐标图")


def _errorbar(fig, df, p):
    ax = fig.add_subplot(111)
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴"); _need(df, p["error"], "误差")
    ax.errorbar(range(len(df)), _num(df, p["y"]), yerr=_num(df, p["error"]),
                fmt="o-", capsize=3, linewidth=2)
    _labels(ax, df, p["x"], tick_step=max(1, len(df) // 20))
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.grid(True, alpha=0.3)
    _title(ax, p, "误差条图")


def _technical(fig, df, p):
    """技术面组合图：价格 + MA + 布林带 + RSI。需要指标列（见 market_data.indicators）。"""
    need = ["收盘", "MA5", "MA20", "BOLL上", "BOLL下", "RSI"]
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise ValueError(f"缺少指标列: {missing}（请用 source='api' 自动计算，或先运行 market_data.indicators）")
    x = list(range(len(df)))
    ax1 = fig.add_subplot(2, 1, 1)
    ax1.plot(x, df["收盘"], label="收盘", color="#1f77b4", linewidth=1.8)
    ax1.plot(x, df["MA5"], label="MA5", color="#ff7f0e", linewidth=1.2)
    ax1.plot(x, df["MA20"], label="MA20", color="#d62728", linewidth=1.2)
    ax1.fill_between(x, df["BOLL上"], df["BOLL下"], alpha=0.12, color="gray", label="布林带")
    ax1.set_ylabel("价格")
    ax1.legend(loc="upper left", fontsize=8)
    ax1.grid(True, alpha=0.3)

    ax2 = fig.add_subplot(2, 1, 2, sharex=ax1)
    ax2.plot(x, df["RSI"], label="RSI14", color="#9467bd", linewidth=1.4)
    ax2.axhline(70, color="red", linestyle="--", linewidth=0.8)
    ax2.axhline(30, color="green", linestyle="--", linewidth=0.8)
    ax2.set_ylim(0, 100)
    ax2.set_ylabel("RSI")
    ax2.legend(loc="upper left", fontsize=8)
    ax2.grid(True, alpha=0.3)
    labels = df["日期"].astype(str).tolist()
    step = max(1, len(df) // 15)
    ax2.set_xticks(x[::step])
    ax2.set_xticklabels([labels[i] for i in x[::step]], rotation=45, ha="right", fontsize=8)
    _title(ax1, p, "技术面分析")


def _wordcloud(fig, df, p):
    """词云：x_column 为文本列（中文自动 jieba 分词）。"""
    _need(df, p["x"], "文本列")
    try:
        import jieba
        from wordcloud import WordCloud
    except ImportError as e:
        raise ValueError(f"词云需要安装 wordcloud 和 jieba：pip install wordcloud jieba（{e}）") from e
    text = " ".join(jieba.cut(" ".join(df[p["x"]].astype(str).tolist())))
    font_path = r"C:\Windows\Fonts\msyh.ttc"
    wc = WordCloud(font_path=font_path if os.path.exists(font_path) else None,
                   width=1000, height=600, background_color="white", max_words=100).generate(text)
    ax = fig.add_subplot(111)
    ax.imshow(wc)
    ax.axis("off")
    _title(ax, p, "词云")


def _sankey(fig, df, p):
    """桑基图：x_column=源、y_column=目标、value_column=流量。"""
    _need(df, p["x"], "源"); _need(df, p["y"], "目标"); _need(df, p["value"], "流量")
    data = pd.DataFrame({
        "src": df[p["x"]].astype(str),
        "dst": df[p["y"]].astype(str),
        "val": pd.to_numeric(df[p["value"]], errors="coerce").fillna(0),
    })
    data = data[data["val"] > 0]
    if data.empty:
        raise ValueError("没有正流量数据，无法绘制桑基图")

    src_nodes = sorted(data["src"].unique())
    dst_nodes = sorted(data["dst"].unique())
    out_flows = data.groupby("src")["val"].sum().to_dict()
    in_flows = data.groupby("dst")["val"].sum().to_dict()

    def positions(nodes, flows):
        total = sum(flows.get(n, 0) for n in nodes) or 1
        ys, y = {}, 0.95
        for n in nodes:
            h = 0.8 * flows.get(n, 0) / total
            ys[n] = (y, y - h)
            y -= h + 0.02
        return ys

    src_ys = positions(src_nodes, out_flows)
    dst_ys = positions(dst_nodes, in_flows)
    x0, x1 = 0.08, 0.92
    import matplotlib.patches as mpatches
    from matplotlib.path import Path as MPath

    ax = fig.add_subplot(111)
    for n, (ya, yb) in src_ys.items():
        ax.add_patch(mpatches.Rectangle((x0 - 0.012, yb), 0.024, ya - yb, color="#4e79a7"))
        ax.text(x0 - 0.018, (ya + yb) / 2, n, ha="right", va="center", fontsize=8)
    for n, (ya, yb) in dst_ys.items():
        ax.add_patch(mpatches.Rectangle((x1 - 0.012, yb), 0.024, ya - yb, color="#f28e2b"))
        ax.text(x1 + 0.018, (ya + yb) / 2, n, ha="left", va="center", fontsize=8)

    colors = plt.cm.tab20(np.linspace(0, 1, len(data)))
    for (_, r), color in zip(data.iterrows(), colors):
        m0 = (src_ys[r["src"]][0] + src_ys[r["src"]][1]) / 2
        m1 = (dst_ys[r["dst"]][0] + dst_ys[r["dst"]][1]) / 2
        verts = [(x0, m0), (0.5, m0), (0.5, m1), (x1, m1)]
        codes = [MPath.MOVETO, MPath.CURVE4, MPath.CURVE4, MPath.CURVE4]
        ax.add_patch(mpatches.PathPatch(MPath(verts, codes), fc=color, alpha=0.35, ec="none"))
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    _title(ax, p, "桑基图")


def _treemap(fig, df, p):
    try:
        import squarify
    except ImportError as e:
        raise ValueError(f"矩形树图需要安装 squarify：pip install squarify（{e}）") from e
    ax = fig.add_subplot(111)
    _need(df, p["x"], "分类"); _need(df, p["y"], "数值")
    data = pd.DataFrame({"label": df[p["x"]].astype(str), "val": _num(df, p["y"])}).dropna()
    if len(data) > 30:
        data = data.sort_values("val", ascending=False).head(30)
    colors = plt.cm.Blues(np.linspace(0.35, 0.95, len(data)))
    squarify.plot(sizes=data["val"].tolist(), label=data["label"].tolist(),
                  color=colors, alpha=0.8, ax=ax, text_kwargs={"fontsize": 8})
    ax.axis("off")
    _title(ax, p, "矩形树图")


def _scatter3d(fig, df, p):
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴"); _need(df, p["value"], "Z 轴(数值)")
    ax = fig.add_subplot(111, projection="3d")
    ax.scatter(_num(df, p["x"]), _num(df, p["y"]), _num(df, p["value"]), s=40, alpha=0.7)
    ax.set_xlabel(p["x"]); ax.set_ylabel(p["y"]); ax.set_zlabel(p["value"])
    _title(ax, p, "3D 散点图")


def _surface(fig, df, p):
    _need(df, p["x"], "X 轴"); _need(df, p["y"], "Y 轴"); _need(df, p["value"], "Z 轴(数值)")
    pivot = df.pivot_table(index=p["x"], columns=p["y"], values=p["value"], aggfunc="mean")
    X, Y = np.meshgrid(np.arange(pivot.shape[1]), np.arange(pivot.shape[0]))
    Z = pivot.values.astype(float)
    ax = fig.add_subplot(111, projection="3d")
    ax.plot_surface(X, Y, Z, cmap="viridis", alpha=0.9)
    ax.set_xlabel(p["y"]); ax.set_ylabel(p["x"]); ax.set_zlabel(p["value"])
    _title(ax, p, "3D 曲面图")


# ==================== 分派表 ====================

HANDLERS = {
    "line": _line,
    "bar": _bar,
    "barh": _barh,
    "stacked_bar": _stacked_bar,
    "grouped_bar": _grouped_bar,
    "scatter": _scatter,
    "bubble": _bubble,
    "pie": _pie,
    "donut": _donut,
    "area": _area,
    "candlestick": _candlestick,
    "box": _box,
    "violin": _violin,
    "histogram": _histogram,
    "heatmap": _heatmap,
    "radar": _radar,
    "waterfall": _waterfall,
    "funnel": _funnel,
    "step": _step,
    "polar": _polar,
    "errorbar": _errorbar,
    "technical": _technical,
    "wordcloud": _wordcloud,
    "sankey": _sankey,
    "treemap": _treemap,
    "scatter3d": _scatter3d,
    "surface": _surface,
}


def supported_types():
    return sorted(HANDLERS)


def build_figure(chart_type, df, x_column=None, y_column=None, y_columns=None, value_column=None,
                 open_column=None, high_column=None, low_column=None, close_column=None,
                 size_column=None, error_column=None, title=None):
    """按图表类型生成 matplotlib Figure。列不存在或参数缺失时抛出中文提示。"""
    handler = HANDLERS.get(chart_type)
    if handler is None:
        raise ValueError(f"不支持的图表类型: {chart_type}，可用类型: {', '.join(supported_types())}")
    # 大数据降采样：折线/散点/面积/步进/气泡/误差条 超过 5 万点时按比例抽样，保证渲染性能
    if chart_type in ("line", "scatter", "area", "step", "errorbar", "bubble") and len(df) > 50000:
        step = len(df) // 50000
        df = df.iloc[::step].reset_index(drop=True)
    y_cols = [c.strip() for c in (y_columns or "").split(",") if c.strip()]
    params = {
        "x": x_column, "y": y_column, "y_cols": y_cols, "value": value_column,
        "open": open_column, "high": high_column, "low": low_column, "close": close_column,
        "size": size_column, "error": error_column, "title": title,
    }
    fig = plt.figure(figsize=(12, 6))
    handler(fig, df, params)
    try:
        fig.tight_layout()
    except Exception:
        pass
    return fig
