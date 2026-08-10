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


def quote(symbol):
    """获取实时行情。返回字典：名称、现价、涨跌幅、成交量等。"""
    norm = _normalize_symbol(symbol)
    try:
        data = _fetch_tencent(norm)
        data["来源"] = "腾讯行情"
        return data
    except Exception as e:
        # 回退：yfinance（美股/港股等）
        try:
            import yfinance as yf
        except ImportError:
            raise ValueError(f"腾讯行情获取失败: {e}（未安装 yfinance，无法回退海外行情）") from e
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

    norm = _normalize_symbol(symbol)
    url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={norm},day,,,{days},qfq"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = _json.loads(resp.read().decode("utf-8", errors="replace"))
    node = data.get("data", {}).get(norm, {})
    rows = node.get("qfqday") or node.get("day") or []
    if not rows:
        raise ValueError(f"未获取到K线数据（{norm}）")
    import pandas as pd
    df = pd.DataFrame([r[:6] for r in rows], columns=["日期", "开盘", "收盘", "最高", "最低", "成交量"])
    for c in ("开盘", "收盘", "最高", "最低", "成交量"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df
