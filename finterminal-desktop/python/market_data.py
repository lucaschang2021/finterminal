"""
实时行情数据源模块（FinTerminal）
==================================
优先使用腾讯行情接口（qt.gtimg.cn，无需密钥，覆盖 A股/港股/美股，国内直连）；
海外标的可回退到 yfinance（需自行安装并可联网）。

调用方式（经 read 工具）：read(source="api", file_path="sh600519")
"""

import hashlib
import json
import os
import re
import time
import warnings
from pathlib import Path


def _cache_root():
    """缓存根目录：打包模式支持 FIN_DATA_DIR（onefile 下 __file__ 指向一次性目录）。"""
    env = os.environ.get("FIN_DATA_DIR")
    return Path(env) if env else Path(__file__).parent


CACHE_DIR = _cache_root() / "cache" / "market"

# 静默 statsmodels 在 ARIMA/ETS 拟合中的已知噪音警告（收敛/索引），保持工具输出干净
warnings.filterwarnings("ignore", message="Maximum Likelihood optimization failed")
warnings.filterwarnings("ignore", message="Non-invertible starting MA")
warnings.filterwarnings("ignore", message="Non-stationary starting autoregressive")
warnings.filterwarnings("ignore", message="No supported index")
warnings.filterwarnings("ignore", message="Setting the shape on a NumPy array")


class _LazyPandas:
    _m = None

    def __getattr__(self, name):
        if self._m is None:
            import pandas as _pd
            self._m = _pd
        return getattr(self._m, name)


pd = _LazyPandas()


def _json_default(o):
    """JSON 序列化兜底：转换 numpy 标量等。"""
    if hasattr(o, "item"):
        try:
            return o.item()
        except Exception:
            return str(o)
    return str(o)


def _cache_get(key, ttl):
    try:
        p = CACHE_DIR / (hashlib.md5(key.encode()).hexdigest() + ".json")
        if p.exists() and time.time() - p.stat().st_mtime < ttl:
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


def _cache_set(key, data):
    try:
        p = CACHE_DIR / (hashlib.md5(key.encode()).hexdigest() + ".json")
        p.parent.mkdir(parents=True, exist_ok=True)
        # 原子写入：先写临时文件再替换，避免并发读到的撕裂内容
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, default=_json_default), encoding="utf-8")
        os.replace(tmp, p)
    except Exception:
        pass


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


def _ak_kline(symbol, days=120, period="daily"):
    """AkShare（东方财富）日K线回退。"""
    import akshare as ak
    import pandas as pd
    code = _strip_prefix(symbol)
    hist = ak.stock_zh_a_hist(symbol=code, period=period, adjust="qfq")
    hist = hist.tail(days).reset_index(drop=True)
    return pd.DataFrame({
        "日期": hist["日期"].astype(str),
        "开盘": hist["开盘"], "收盘": hist["收盘"],
        "最高": hist["最高"], "最低": hist["最低"],
        "成交量": hist["成交量"],
    })


def _plugin_call(kind, symbol, *args, **kwargs):
    """调用插件提供的数据源；返回数据或 None。"""
    try:
        import plugin_manager
    except Exception:
        return None
    for name, fn in plugin_manager.get_providers(kind):
        try:
            result = fn(symbol, *args, **kwargs)
            if result is not None and result is not False:
                if isinstance(result, dict):
                    result.setdefault("来源", f"插件:{name}")
                return result
        except Exception:
            continue
    return None


def quote(symbol, use_cache=True):
    """获取实时行情（带 30 秒本地缓存）。返回字典：名称、现价、涨跌幅、成交量等。"""
    key = f"quote:{symbol}"
    if use_cache:
        cached = _cache_get(key, 30)
        if cached:
            cached = dict(cached)
            cached["_cached"] = True
            return cached
    data = _quote_fetch(symbol)
    _cache_set(key, data)
    return data


def _quote_fetch(symbol):
    norm = _normalize_symbol(symbol)
    try:
        data = _fetch_tencent(norm)
        data["来源"] = "腾讯行情"
        return data
    except Exception as e:
        # 回退1：AkShare（东方财富，国内直连）
        e2 = None
        try:
            return _ak_quote(symbol)
        except Exception as ex:
            e2 = ex
        # 回退2：yfinance（美股/港股等）
        try:
            import yfinance as yf
            t = yf.Ticker(symbol)
            info = t.fast_info
            return {
                "名称": symbol, "代码": symbol, "现价": getattr(info, "last_price", None),
                "昨收": getattr(info, "previous_close", None), "今开": getattr(info, "open", None),
                "涨跌幅%": None, "成交量": getattr(info, "last_volume", None),
                "来源": "yfinance",
            }
        except Exception as e3:
            pdata = _plugin_call("quote", symbol)
            if pdata is not None:
                return pdata
            raise ValueError(f"腾讯/AkShare/yfinance 行情均失败: {e} / {e2} / {e3}") from e3


_PERIOD_MAP = {"daily": "day", "weekly": "week", "monthly": "month"}


def kline(symbol, days=60, period="daily", use_cache=True):
    """获取K线（前复权，支持 daily/weekly/monthly，带 1 小时缓存）。
    返回 DataFrame：日期/开盘/收盘/最高/最低/成交量。"""
    key = f"kline:{symbol}:{days}:{period}"
    if use_cache:
        cached = _cache_get(key, 3600)
        if cached:
            return pd.DataFrame(cached["rows"], columns=cached["cols"])
    df = _kline_fetch(symbol, days, period)
    _cache_set(key, {"cols": list(df.columns),
                     "rows": df.astype(object).where(pd.notnull(df), None).values.tolist()})
    return df


def _kline_fetch(symbol, days=60, period="daily"):
    import json as _json
    import urllib.request

    import pandas as pd
    try:
        norm = _normalize_symbol(symbol)
        p = _PERIOD_MAP.get(period, "day")
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={norm},{p},,,{days},qfq"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = _json.loads(resp.read().decode("utf-8", errors="replace"))
        node = data.get("data", {}).get(norm, {})
        key_map = {"daily": ("qfqday", "day"),
                   "weekly": ("qfqweek", "week"),
                   "monthly": ("qfqmonth", "month")}
        k1, k2 = key_map.get(period, ("qfqday", "day"))
        rows = node.get(k1) or node.get(k2) or node.get("qfqday") or node.get("day") or []
        if not rows:
            raise ValueError(f"未获取到K线数据（{norm}）")
        df = pd.DataFrame([r[:6] for r in rows], columns=["日期", "开盘", "收盘", "最高", "最低", "成交量"])
        for c in ("开盘", "收盘", "最高", "最低", "成交量"):
            df[c] = pd.to_numeric(df[c], errors="coerce")
        return df
    except Exception as e:
        # 回退1：AkShare（东方财富，国内直连）
        e2 = None
        try:
            return _ak_kline(symbol, days, period if period in ("daily", "weekly", "monthly") else "daily")
        except Exception as ex:
            e2 = ex
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
        except Exception as e3:
            pdata = _plugin_call("kline", symbol, days, period)
            if pdata is not None:
                return pdata
            raise ValueError(f"腾讯/AkShare/yfinance K线均失败（{symbol}）: {e} / {e2} / {e3}") from e3


def cross_check(symbol):
    """多源交叉验证：腾讯 vs AkShare（东财）的现价与涨跌幅对比。"""
    t = _fetch_tencent(_normalize_symbol(symbol))
    a = _ak_quote(symbol)

    def num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    t_price, a_price = num(t.get("现价")), num(a.get("现价"))
    t_chg, a_chg = num(t.get("涨跌幅%")), num(a.get("涨跌幅%"))
    rows = [
        {"指标": "现价", "腾讯": t_price, "AkShare(东财)": a_price},
        {"指标": "涨跌幅%", "腾讯": t_chg, "AkShare(东财)": a_chg},
    ]
    verdict = "✅ 两源一致"
    if t_price and a_price and abs(t_price - a_price) / max(a_price, 1e-9) > 0.005:
        verdict = "⚠️ 现价差异超过 0.5%，请核实数据源"
    if t_chg is not None and a_chg is not None and abs(t_chg - a_chg) > 0.5:
        verdict = "⚠️ 涨跌幅差异超过 0.5%，请核实数据源"
    return rows, verdict


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

    # KDJ(9,3,3)
    low9 = df["最低"].rolling(9).min()
    high9 = df["最高"].rolling(9).max()
    rsv = (close - low9) / (high9 - low9).replace(0, np.nan) * 100
    df["K"] = rsv.ewm(com=2, adjust=False).mean()
    df["D"] = df["K"].ewm(com=2, adjust=False).mean()
    df["J"] = 3 * df["K"] - 2 * df["D"]

    # OBV 能量潮
    direction = np.sign(close.diff()).fillna(0)
    df["OBV"] = (direction * df["成交量"]).cumsum()

    # ATR(14) 平均真实波幅
    prev_close = close.shift()
    tr = pd.concat([df["最高"] - df["最低"],
                    (df["最高"] - prev_close).abs(),
                    (df["最低"] - prev_close).abs()], axis=1).max(axis=1)
    df["ATR"] = tr.rolling(14).mean()
    return df


def forecast(symbol, days=120, horizon=10, model="auto"):
    """价格预测（支持 linear/arima/ets/auto，auto 按 AIC 择优、失败回退 linear）。
    返回 (原始K线+指标 DataFrame, 预测 DataFrame, 模型信息 dict)。"""
    df = kline(symbol, days)
    fdf, info = forecast_model(df["收盘"], horizon, model)
    return indicators(df), fdf, info


def forecast_model(series, horizon=10, model="auto"):
    """多模型时序预测。返回 (预测 DataFrame, 模型信息 dict)。"""
    import numpy as np
    import pandas as pd
    y = pd.to_numeric(pd.Series(series), errors="coerce").dropna().astype(float)
    if len(y) < 3:
        empty = pd.DataFrame({
            "期数": [f"T+{i}" for i in range(1, horizon + 1)],
            "预测收盘": [None] * horizon,
            "下界": [None] * horizon,
            "上界": [None] * horizon,
        })
        return empty, {"模型": "linear", "说明": "有效样本不足 3 期，无法预测"}
    if len(y) < 6:
        fdf = forecast_from_df(pd.DataFrame({"收盘": y}), horizon)
        fdf.insert(0, "期数", [f"T+{i}" for i in range(1, horizon + 1)])
        return fdf, {"模型": "linear", "说明": "样本不足，使用线性趋势"}

    def _linear():
        fdf = forecast_from_df(pd.DataFrame({"收盘": y}), horizon)
        return fdf, {"模型": "linear"}

    def _ets():
        from statsmodels.tools.sm_exceptions import ConvergenceWarning
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        warnings.filterwarnings("ignore", category=ConvergenceWarning)
        fit = ExponentialSmoothing(y, trend="add", damped_trend=False).fit()
        fc = fit.forecast(horizon)
        resid = y - fit.fittedvalues
        sigma = float(resid.std(ddof=2)) if len(resid) > 2 else 0.0
        band = 1.96 * sigma
        return (pd.DataFrame({"预测收盘": np.round(fc.values, 2),
                              "下界": np.round(fc.values - band, 2),
                              "上界": np.round(fc.values + band, 2)}),
                {"模型": "ets", "AIC": round(float(fit.aic), 2) if hasattr(fit, "aic") else None})

    def _arima():
        from statsmodels.tools.sm_exceptions import ConvergenceWarning
        from statsmodels.tsa.arima.model import ARIMA
        warnings.filterwarnings("ignore", category=ConvergenceWarning)
        warnings.filterwarnings("ignore", message="Too few observations to estimate")
        warnings.filterwarnings("ignore", message="Non-invertible starting MA")
        warnings.filterwarnings("ignore", message="Non-stationary starting autoregressive")
        warnings.filterwarnings("ignore", message="Setting the shape on a NumPy array")
        best = None
        # 精选阶数网格：覆盖常用 AR/MA/差分组合，避免 18 次全网格拟合的延迟
        for order in ((1, 1, 1), (2, 1, 0), (1, 1, 0), (0, 1, 1), (2, 1, 1)):
            try:
                fit = ARIMA(y, order=order).fit()
                if best is None or fit.aic < best[0]:
                    best = (fit.aic, fit)
            except Exception:
                continue
        if best is None:
            raise ValueError("ARIMA 拟合失败")
        aic, fit = best
        fc = fit.get_forecast(horizon)
        ci = fc.conf_int()
        return (pd.DataFrame({"预测收盘": np.round(fc.predicted_mean.values, 2),
                              "下界": np.round(ci.iloc[:, 0].values, 2),
                              "上界": np.round(ci.iloc[:, 1].values, 2)}),
                {"模型": "arima", "AIC": round(float(aic), 2)})

    models = {"linear": _linear, "ets": _ets, "arima": _arima}
    candidates = ["arima", "ets", "linear"] if model == "auto" else [model] if model in models else ["linear"]
    last_err = None
    for m in candidates:
        try:
            fdf, info = models[m]()
            fdf.insert(0, "期数", [f"T+{i}" for i in range(1, horizon + 1)])
            return fdf, info
        except Exception as e:
            last_err = e
            continue
    fdf = forecast_from_df(pd.DataFrame({"收盘": y}), horizon)
    fdf.insert(0, "期数", [f"T+{i}" for i in range(1, horizon + 1)])
    return fdf, {"模型": "linear", "回退原因": str(last_err)}


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
