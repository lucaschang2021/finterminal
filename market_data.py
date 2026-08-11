# -*- coding: utf-8 -*-
"""
实时行情数据源模块（FinTerminal）
==================================
优先使用腾讯行情接口（qt.gtimg.cn，无需密钥，覆盖 A股/港股/美股，国内直连）；
海外标的可回退到 yfinance（需自行安装并可联网）。

调用方式（经 read 工具）：read(source="api", file_path="sh600519")
"""

import re


def _fetch_tencent(symbol):
    """从腾讯行情接口获取实时报价，返回字段字典。"""
    import urllib.request
    url = f"https://qt.gtimg.cn/q={symbol}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("gbk", errors="replace")
    m = re.search(r'="(.*)";?\s*$', raw.strip())
    if not m:
        raise ValueError(f"无法解析行情响应: {raw[:120]}")
    parts = m.group(1).split("~")
    if len(parts) < 40:
        raise ValueError(f"行情字段不足（{len(parts)}），接口可能变更")

    def num(i):
        v = parts[i] if i < len(parts) else ""
        return v if v not in ("", "-") else None

    return {
        "名称": parts[1],
        "代码": parts[2],
        "现价": num(3),
        "昨收": num(4),
        "今开": num(5),
        "成交量(手)": num(6),
        "涨跌": num(31),
        "涨跌幅%": num(32),
        "最高": num(33),
        "最低": num(34),
        "成交额(万元)": num(37),
        "换手率%": num(38),
        "市盈率": num(39),
        "总市值(亿)": num(45),
    }


def _normalize_symbol(symbol):
    """规范化股票代码：纯数字补市场前缀，未带前缀补 sh。"""
    symbol = symbol.strip()
    if re.fullmatch(r"\d{6}", symbol):
        # 6 开头为沪市，其余为深市
        return ("sh" if symbol[0] in "569" else "sz") + symbol
    if re.match(r"^(sh|sz|hk|us|bj)", symbol, re.I):
        return symbol.lower()
    return "sh" + symbol


def _strip_prefix(symbol):
    return re.sub(r"^(sh|sz|bj|hk|us)", "", symbol, flags=re.I)


def _ak_quote(symbol):
    """AkShare（东方财富）实时行情回退。"""
    import akshare as ak
    code = _strip_prefix(symbol)
    info = ak.stock_individual_info_em(symbol=code)
    name = code
    for _, row in info.iterrows():
        if str(row.get("item", "")) == "股票简称":
            name = str(row.get("value", code))
    spot = ak.stock_zh_a_spot_em()
    row = spot[spot["代码"] == code]
    if row.empty:
        raise ValueError(f"AkShare 未找到 {code}")
    r = row.iloc[0]
    return {
        "名称": name, "代码": code,
        "现价": r.get("最新价"), "昨收": r.get("昨收"), "今开": r.get("今开"),
        "成交量": r.get("成交量"), "涨跌幅%": r.get("涨跌幅"),
        "最高": r.get("最高"), "最低": r.get("最低"),
        "换手率%": r.get("换手率"), "市盈率": r.get("市盈率-动态"),
        "来源": "AkShare(东方财富)",
    }


def _ak_kline(symbol, days=120):
    """AkShare（东方财富）日K线回退。"""
    import akshare as ak
    import pandas as pd
    code = _strip_prefix(symbol)
    hist = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")
    hist = hist.tail(days).reset_index(drop=True)
    return pd.DataFrame({
        "日期": hist["日期"].astype(str),
        "开盘": hist["开盘"], "收盘": hist["收盘"],
        "最高": hist["最高"], "最低": hist["最低"],
        "成交量": hist["成交量"],
    })


def quote(symbol):
    """获取实时行情。返回字典：名称、现价、涨跌幅、成交量等。"""
    norm = _normalize_symbol(symbol)
    try:
        data = _fetch_tencent(norm)
        data["来源"] = "腾讯行情"
        return data
    except Exception as e:
        # 回退1：AkShare（东方财富，国内直连）
        try:
            return _ak_quote(symbol)
        except Exception as e2:
            pass
        # 回退2：yfinance（美股/港股等）
        try:
            import yfinance as yf
        except ImportError:
            raise ValueError(f"腾讯/AkShare 行情均失败: {e} / {e2}（未安装 yfinance）") from e
        t = yf.Ticker(symbol)
        info = t.fast_info
        return {
            "名称": symbol, "代码": symbol, "现价": getattr(info, "last_price", None),
            "昨收": getattr(info, "previous_close", None), "今开": getattr(info, "open", None),
            "涨跌幅%": None, "成交量": getattr(info, "last_volume", None),
            "来源": "yfinance",
        }


def kline(symbol, days=60):
    """获取日K线（前复权）。返回 DataFrame：日期/开盘/收盘/最高/最低/成交量。"""
    import json as _json
    import urllib.request

    import pandas as pd
    try:
        norm = _normalize_symbol(symbol)
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={norm},day,,,{days},qfq"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = _json.loads(resp.read().decode("utf-8", errors="replace"))
        node = data.get("data", {}).get(norm, {})
        rows = node.get("qfqday") or node.get("day") or []
        if not rows:
            raise ValueError(f"未获取到K线数据（{norm}）")
        df = pd.DataFrame([r[:6] for r in rows], columns=["日期", "开盘", "收盘", "最高", "最低", "成交量"])
        for c in ("开盘", "收盘", "最高", "最低", "成交量"):
            df[c] = pd.to_numeric(df[c], errors="coerce")
        return df
    except Exception as e:
        # 回退1：AkShare（东方财富，国内直连）
        try:
            return _ak_kline(symbol, days)
        except Exception as e2:
            pass
        # 回退2：海外标的回退 yfinance（需可访问 Yahoo）
        try:
            import yfinance as yf
            t = yf.Ticker(symbol)
            h = t.history(period=f"{days}d")
            if h.empty:
                raise ValueError("无历史数据")
            return pd.DataFrame({
                "日期": h.index.strftime("%Y-%m-%d"),
                "开盘": h["Open"].to_numpy(), "收盘": h["Close"].to_numpy(),
                "最高": h["High"].to_numpy(), "最低": h["Low"].to_numpy(),
                "成交量": h["Volume"].to_numpy(),
            })
        except ImportError:
            raise ValueError(f"腾讯/AkShare K线均失败: {e} / {e2}（未安装 yfinance）") from e
        except Exception as e3:
            raise ValueError(f"腾讯/AkShare/yfinance K线均失败（{symbol}）: {e} / {e2} / {e3}") from e3


def indicators(df):
    """计算常用技术指标并追加到 K 线 DataFrame：MA5/10/20/60、MACD、RSI14、布林带。"""
    import numpy as np
    df = df.copy().sort_values("日期").reset_index(drop=True)
    close = df["收盘"]
    df["MA5"] = close.rolling(5).mean()
    df["MA10"] = close.rolling(10).mean()
    df["MA20"] = close.rolling(20).mean()
    df["MA60"] = close.rolling(60).mean()

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["DIF"] = ema12 - ema26
    df["DEA"] = df["DIF"].ewm(span=9, adjust=False).mean()
    df["MACD"] = (df["DIF"] - df["DEA"]) * 2

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    flat = (gain == 0) & (loss == 0)
    rsi = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    rsi = rsi.fillna(100.0)          # 无亏损期（含全上涨）→ 100
    rsi = rsi.where(~flat, 50.0)     # 横盘 → 50
    rsi = rsi.where(~((gain == 0) & (loss > 0)), 0.0)  # 无上涨有亏损 → 0
    df["RSI"] = rsi

    mid = close.rolling(20).mean()
    std = close.rolling(20).std()
    df["BOLL上"] = mid + 2 * std
    df["BOLL中"] = mid
    df["BOLL下"] = mid - 2 * std
    return df


def forecast(symbol, days=120, horizon=10):
    """基于线性趋势的简单价格预测（含 95% 近似置信区间）。
    返回 (原始K线+指标 DataFrame, 预测 DataFrame)。"""
    df = kline(symbol, days)
    return indicators(df), forecast_from_df(df, horizon)


def forecast_from_df(df, horizon=10):
    """基于已有 K 线 DataFrame 做线性趋势预测。返回预测 DataFrame。"""
    import numpy as np
    import pandas as pd
    y = df["收盘"].to_numpy(dtype=float)
    n = len(y)
    x = np.arange(n)
    slope, intercept = np.polyfit(x, y, 1)
    resid = y - (slope * x + intercept)
    sigma = float(resid.std(ddof=2)) if n > 2 else 0.0
    fx = np.arange(n, n + horizon)
    fy = slope * fx + intercept
    band = 1.96 * sigma * np.sqrt(1 + 1 / n + ((fx - x.mean()) ** 2).sum() / ((x - x.mean()) ** 2).sum())
    fdf = pd.DataFrame({
        "日期": [str(i) for i in range(1, horizon + 1)],
        "预测收盘": np.round(fy, 2),
        "下界": np.round(fy - band, 2),
        "上界": np.round(fy + band, 2),
    })
    fdf["日期"] = [f"T+{i}" for i in range(1, horizon + 1)]
    return fdf
