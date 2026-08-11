# -*- coding: utf-8 -*-
"""
统计分析模块（FinTerminal）
==========================
面向学术论文研究的统计分析功能：
- 描述性统计（均值/分位数/偏度/峰度/缺失值）
- 相关分析（Pearson 相关系数 + 显著性 p 值）
- 分组统计（groupby 聚合）
- 线性回归（OLS：系数/标准误/t 值/p 值/R²/F 检验）
- 显著性检验（独立样本 t 检验 / 单因素方差分析 ANOVA）
- 时间趋势（总增幅/CAGR/平均环比/线性趋势）
- Markdown 表格生成（供自动报告使用）

依赖：numpy / pandas / scipy（回归用最小二乘手写实现，无需 statsmodels）。
"""

import numpy as np


class _LazyPandas:
    _m = None

    def __getattr__(self, name):
        if self._m is None:
            import pandas as _pd
            self._m = _pd
        return getattr(self._m, name)


pd = _LazyPandas()


class _LazyStats:
    """惰性加载 scipy.stats：首次使用才导入，加快服务启动。"""
    _m = None

    def __getattr__(self, name):
        if self._m is None:
            from scipy import stats
            self._m = stats
        return getattr(self._m, name)


stats = _LazyStats()


# ==================== 基础工具 ====================

def _num(df, col):
    return pd.to_numeric(df[col], errors="coerce")


def _numeric_cols(df, columns=None):
    """解析用户指定的列；未指定时取全部数值列。"""
    if columns:
        cols = [c.strip() for c in columns.split(",") if c.strip()]
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise ValueError(f"列不存在: {missing}，可用列: {', '.join(str(c) for c in df.columns)}")
        return cols
    return [str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]


def md_table(df):
    """把 DataFrame 渲染成 Markdown 表格。"""
    cols = list(df.columns)
    lines = [
        "| " + " | ".join(str(c) for c in cols) + " |",
        "|" + "|".join("---" for _ in cols) + "|",
    ]
    for _, row in df.iterrows():
        cells = ["" if v is None or (isinstance(v, float) and np.isnan(v)) else str(v) for v in row]
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def significance_star(p):
    """显著性星标：* p<0.05，** p<0.01，*** p<0.001。"""
    if p is None:
        return ""
    try:
        if np.isnan(float(p)):
            return ""
    except (TypeError, ValueError):
        return ""
    if p < 0.001:
        return "***"
    if p < 0.01:
        return "**"
    if p < 0.05:
        return "*"
    return ""


# ==================== 描述性统计 ====================

def describe(df, columns=None):
    """描述性统计表：样本数、均值、标准差、分位数、偏度、峰度、缺失。"""
    cols = _numeric_cols(df, columns)
    if not cols:
        raise ValueError("没有可分析的数值列")
    rows = []
    for c in cols:
        s = _num(df, c)
        valid = s.dropna()
        n = len(valid)
        base = {"指标": c, "样本数": n, "缺失": int(s.isna().sum())}
        if n == 0:
            base.update({"均值": None, "标准差": None, "最小值": None, "25%": None,
                         "中位数": None, "75%": None, "最大值": None, "偏度": None, "峰度": None})
        else:
            base.update({
                "均值": round(float(valid.mean()), 4),
                "标准差": round(float(valid.std(ddof=1)), 4),
                "最小值": round(float(valid.min()), 4),
                "25%": round(float(valid.quantile(0.25)), 4),
                "中位数": round(float(valid.median()), 4),
                "75%": round(float(valid.quantile(0.75)), 4),
                "最大值": round(float(valid.max()), 4),
                "偏度": round(float(valid.skew()), 4),
                "峰度": round(float(valid.kurtosis()), 4),
            })
        rows.append(base)
    return pd.DataFrame(rows)


# ==================== 相关分析 ====================

def correlation(df, columns=None):
    """Pearson 相关系数矩阵与显著性 p 值矩阵。返回 (r_df, p_df)。"""
    cols = _numeric_cols(df, columns)
    if len(cols) < 2:
        raise ValueError("相关分析至少需要 2 个数值列")
    data = df[cols].apply(pd.to_numeric, errors="coerce").dropna()
    r_df = data.corr()
    p_df = pd.DataFrame(index=cols, columns=cols, dtype=float)
    for a in cols:
        for b in cols:
            if a == b:
                p_df.loc[a, b] = np.nan
                continue
            try:
                _, p = stats.pearsonr(data[a], data[b])
                p_df.loc[a, b] = p
            except Exception:
                p_df.loc[a, b] = np.nan
    return r_df, p_df


def significant_pairs(r_df, p_df, alpha=0.05):
    """列出显著相关（p<alpha）的变量对。"""
    pairs = []
    cols = list(r_df.columns)
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            p = p_df.loc[a, b]
            if p is not None and not (isinstance(p, float) and np.isnan(p)) and p < alpha:
                pairs.append((a, b, float(r_df.loc[a, b]), float(p)))
    pairs.sort(key=lambda x: -abs(x[2]))
    return pairs


# ==================== 分组统计 ====================

GROUP_AGGS = {"mean": "均值", "sum": "合计", "count": "计数", "std": "标准差",
              "median": "中位数", "min": "最小值", "max": "最大值"}


def groupby(df, group_column, value_columns=None, agg="mean"):
    """按分组列聚合数值列。"""
    if group_column not in df.columns:
        raise ValueError(f"分组列不存在: {group_column}，可用列: {', '.join(str(c) for c in df.columns)}")
    if agg not in GROUP_AGGS:
        raise ValueError(f"不支持的聚合方式: {agg}，可用: {', '.join(GROUP_AGGS)}")
    cols = _numeric_cols(df, value_columns)
    if not cols:
        raise ValueError("没有可聚合的数值列")
    result = df.groupby(group_column)[cols].agg(agg).reset_index()
    return result


# ==================== 线性回归（手写 OLS） ====================

def regression(df, x_columns, y_column):
    """多元线性回归。返回 (系数表 DataFrame, 模型指标 dict)。"""
    if y_column not in df.columns:
        raise ValueError(f"因变量列不存在: {y_column}，可用列: {', '.join(str(c) for c in df.columns)}")
    xs = [c.strip() for c in x_columns.split(",") if c.strip()]
    missing = [c for c in xs if c not in df.columns]
    if missing:
        raise ValueError(f"自变量列不存在: {missing}")
    if not xs:
        raise ValueError("请指定至少一个自变量（x_columns）")
    data = df[[y_column] + xs].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < len(xs) + 2:
        raise ValueError("有效样本量不足（至少需要自变量数 + 2 行）")

    y = data[y_column].to_numpy(dtype=float)
    X = data[xs].to_numpy(dtype=float)
    n, k = len(y), X.shape[1] + 1
    Xd = np.column_stack([np.ones(n), X])
    beta, *_ = np.linalg.lstsq(Xd, y, rcond=None)
    yhat = Xd @ beta
    resid = y - yhat
    sse = float((resid ** 2).sum())
    sst = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - sse / sst if sst > 0 else 0.0
    adj_r2 = 1 - (1 - r2) * (n - 1) / (n - k) if n > k else float("nan")
    mse = sse / (n - k)
    try:
        cov = np.linalg.inv(Xd.T @ Xd) * mse
        se = np.sqrt(np.abs(np.diag(cov)))
    except Exception:
        se = np.full(k, np.nan)
    tvals = beta / se
    pvals = 2 * (1 - stats.t.cdf(np.abs(tvals), df=n - k))

    # 稳健标准误（Huber-White）：应对异方差，论文审稿常见要求
    try:
        XtX_inv = np.linalg.inv(Xd.T @ Xd)
        meat = Xd.T @ np.diag(resid ** 2) @ Xd
        cov_rob = XtX_inv @ meat @ XtX_inv
        se_rob = np.sqrt(np.abs(np.diag(cov_rob)))
        t_rob = beta / se_rob
        p_rob = 2 * (1 - stats.t.cdf(np.abs(t_rob), df=n - k))
    except Exception:
        se_rob = np.full(k, np.nan)
        p_rob = np.full(k, np.nan)

    f = ((sst - sse) / (k - 1)) / mse if k > 1 and mse > 0 else float("nan")
    fp = 1 - stats.f.cdf(f, k - 1, n - k) if not np.isnan(f) else float("nan")

    coef_df = pd.DataFrame({
        "变量": ["截距"] + xs,
        "系数": np.round(beta, 6),
        "标准误": np.round(se, 6),
        "t 值": np.round(tvals, 4),
        "p 值": np.round(pvals, 6),
        "稳健标准误": np.round(se_rob, 6),
        "稳健 p 值": np.round(p_rob, 6),
        "显著性": [significance_star(p) for p in pvals],
    })
    summary = {
        "样本量": n,
        "R²": round(r2, 4),
        "调整R²": round(adj_r2, 4) if not np.isnan(adj_r2) else None,
        "F 统计量": round(f, 4) if not np.isnan(f) else None,
        "F p 值": round(fp, 4) if not np.isnan(fp) else None,
    }
    return coef_df, summary


# ==================== 显著性检验 ====================

def stat_test(df, group_column, value_column, test="ttest"):
    """参数检验：ttest（两组）/ anova（多组）；非参数：mannwhitney（两组）/ kruskal（多组）。"""
    if group_column not in df.columns or value_column not in df.columns:
        raise ValueError("分组列或数值列不存在")
    data = df[[group_column, value_column]].dropna()
    groups = [g[value_column].to_numpy(dtype=float) for _, g in data.groupby(group_column)]
    if len(groups) < 2:
        raise ValueError("至少需要 2 个分组")
    if test == "ttest":
        if len(groups) != 2:
            raise ValueError("t 检验只支持 2 个分组，请改用 anova")
        t, p = stats.ttest_ind(groups[0], groups[1], equal_var=False)
        return {"检验": "独立样本 t 检验（Welch）", "统计量": round(float(t), 4),
                "p 值": round(float(p), 6), "显著性": significance_star(p), "分组数": 2}
    if test == "anova":
        f, p = stats.f_oneway(*groups)
        return {"检验": "单因素方差分析 ANOVA", "统计量": round(float(f), 4),
                "p 值": round(float(p), 6), "显著性": significance_star(p), "分组数": len(groups)}
    if test == "mannwhitney":
        if len(groups) != 2:
            raise ValueError("Mann-Whitney 只支持 2 个分组，请改用 kruskal")
        u, p = stats.mannwhitneyu(groups[0], groups[1], alternative="two-sided")
        return {"检验": "Mann-Whitney U 非参数检验", "统计量": round(float(u), 4),
                "p 值": round(float(p), 6), "显著性": significance_star(p), "分组数": 2}
    if test == "kruskal":
        h, p = stats.kruskal(*groups)
        return {"检验": "Kruskal-Wallis H 非参数检验", "统计量": round(float(h), 4),
                "p 值": round(float(p), 6), "显著性": significance_star(p), "分组数": len(groups)}
    raise ValueError(f"不支持的检验: {test}，可用: ttest / anova / mannwhitney / kruskal")


def vif(df, x_columns):
    """多重共线性诊断：方差膨胀因子 VIF（>10 严重，>5 中等）。"""
    xs = [c.strip() for c in x_columns.split(",") if c.strip()]
    if not xs:
        raise ValueError("请指定自变量（x_columns，逗号分隔）")
    missing = [c for c in xs if c not in df.columns]
    if missing:
        raise ValueError(f"自变量列不存在: {missing}")
    if len(xs) < 2:
        raise ValueError("VIF 至少需要 2 个自变量")
    data = df[xs].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < 3:
        raise ValueError("有效样本不足")
    try:
        inv_corr = np.linalg.inv(data.corr().to_numpy())
    except Exception:
        raise ValueError("相关矩阵不可逆（存在完全共线性），无法计算 VIF")
    rows = []
    for i, c in enumerate(xs):
        v = float(inv_corr[i][i])
        rows.append({"变量": c, "VIF": round(v, 3),
                     "判断": "严重共线性" if v > 10 else ("中等共线性" if v > 5 else "正常")})
    return pd.DataFrame(rows)


def event_study(df, date_column, return_column, event_date, window=(-5, 5)):
    """事件研究：以事件日前后窗口计算异常收益 AR 与累计异常收益 CAR。
    正常收益用事件窗口外的均值收益估计。返回 (AR/CAR 表, 摘要 dict)。"""
    if date_column not in df.columns or return_column not in df.columns:
        raise ValueError("日期列或收益率列不存在")
    data = df[[date_column, return_column]].copy()
    data[date_column] = pd.to_datetime(data[date_column], errors="coerce")
    data[return_column] = pd.to_numeric(data[return_column], errors="coerce")
    data = data.dropna().sort_values(date_column).reset_index(drop=True)
    event = pd.to_datetime(event_date, errors="coerce")
    if pd.isna(event):
        raise ValueError(f"事件日期无法解析: {event_date}")
    est = data[(data[date_column] < event + pd.Timedelta(days=window[0]))]
    if len(est) < 5:
        raise ValueError("估计窗口样本不足（事件前数据少于 5 期）")
    normal = float(est[return_column].mean())
    win = data[(data[date_column] >= event + pd.Timedelta(days=window[0])) &
               (data[date_column] <= event + pd.Timedelta(days=window[1]))].copy()
    if win.empty:
        raise ValueError("事件窗口内无数据")
    win["AR"] = win[return_column] - normal
    win["CAR"] = win["AR"].cumsum()
    out = pd.DataFrame({
        "日期": win[date_column].dt.strftime("%Y-%m-%d"),
        "收益率%": np.round(win[return_column] * 100, 4),
        "异常收益AR%": np.round(win["AR"] * 100, 4),
        "累计异常收益CAR%": np.round(win["CAR"] * 100, 4),
    })
    summary = {"正常收益(估计)%": round(normal * 100, 4),
               "窗口CAR%": round(float(win["CAR"].iloc[-1] * 100), 4),
               "窗口天数": len(win)}
    return out, summary


def did(df, outcome, treat_column, period_column):
    """双重差分 DID：OLS 估计 treat×post 交互项（DID 估计量）。
    treat/period 需为 0/1 二值列。返回 (系数表, 摘要)。"""
    for c in (outcome, treat_column, period_column):
        if c not in df.columns:
            raise ValueError(f"列不存在: {c}")
    data = df[[outcome, treat_column, period_column]].copy()
    for c in (outcome, treat_column, period_column):
        data[c] = pd.to_numeric(data[c], errors="coerce")
    data = data.dropna()
    if not set(data[treat_column].unique()).issubset({0, 1}) or not set(data[period_column].unique()).issubset({0, 1}):
        raise ValueError("treat_column 与 period_column 需为 0/1 二值列")
    data["treat_post"] = data[treat_column] * data[period_column]
    y = data[outcome].to_numpy(dtype=float)
    X = np.column_stack([np.ones(len(y)), data[treat_column], data[period_column], data["treat_post"]])
    n, k = len(y), X.shape[1]
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    sse = float((resid ** 2).sum())
    sst = float(((y - y.mean()) ** 2).sum())
    r2 = 1 - sse / sst if sst > 0 else 0.0
    mse = sse / (n - k)
    try:
        se = np.sqrt(np.abs(np.diag(np.linalg.inv(X.T @ X) * mse)))
    except Exception:
        se = np.full(k, np.nan)
    tvals = beta / se
    pvals = 2 * (1 - stats.t.cdf(np.abs(tvals), df=n - k))
    coef = pd.DataFrame({
        "变量": ["截距", "组别(treat)", "时期(post)", "DID 估计量(treat×post)"],
        "系数": np.round(beta, 6),
        "标准误": np.round(se, 6),
        "t 值": np.round(tvals, 4),
        "p 值": np.round(pvals, 6),
        "显著性": [significance_star(p) for p in pvals],
    })
    return coef, {"DID估计量": round(float(beta[3]), 6), "R²": round(r2, 4), "样本量": n}


# ==================== 时间趋势 ====================

def trend(df, date_column=None, value_columns=None):
    """时间趋势：总增幅、CAGR、平均环比、线性趋势斜率与 R²。"""
    cols = _numeric_cols(df, value_columns)
    if not cols:
        raise ValueError("没有可分析的数值列")
    period = None
    if date_column:
        if date_column not in df.columns:
            raise ValueError(f"日期列不存在: {date_column}")
        df = df.copy()
        df["__date"] = pd.to_datetime(df[date_column], errors="coerce")
        df = df.dropna(subset=["__date"]).sort_values("__date")
        if len(df) >= 2:
            period = (df["__date"].min(), df["__date"].max())

    rows = []
    for c in cols:
        s = _num(df, c).dropna()
        if len(s) < 2:
            rows.append({"指标": c, "期初": None, "期末": None, "总增幅%": None,
                         "CAGR%": None, "平均环比%": None, "线性趋势斜率": None, "趋势R²": None})
            continue
        first, last = float(s.iloc[0]), float(s.iloc[-1])
        total_growth = (last / first - 1) * 100 if first else float("nan")
        n_periods = len(s) - 1
        cagr = ((last / first) ** (1 / max(n_periods, 1)) - 1) * 100 if first > 0 else float("nan")
        x = np.arange(len(s))
        slope, intercept = np.polyfit(x, s, 1)
        yhat = slope * x + intercept
        ss_res = float(((s - yhat) ** 2).sum())
        ss_tot = float(((s - s.mean()) ** 2).sum())
        r2 = 1 - ss_res / ss_tot if ss_tot else float("nan")
        pct_mean = float(s.pct_change().dropna().mean() * 100)
        rows.append({
            "指标": c,
            "期初": round(first, 4),
            "期末": round(last, 4),
            "总增幅%": round(total_growth, 2) if not np.isnan(total_growth) else None,
            "CAGR%": round(cagr, 2) if not np.isnan(cagr) else None,
            "平均环比%": round(pct_mean, 2),
            "线性趋势斜率": round(float(slope), 4),
            "趋势R²": round(r2, 4) if not np.isnan(r2) else None,
        })
    return pd.DataFrame(rows), period
