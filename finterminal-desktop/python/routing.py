"""意图路由与消歧模块（FinTerminal）。

从 mcp_server.py 拆出的「Phase 8 意图路由与消歧」纯函数域：
- 时间意图识别（实时 vs 历史）
- 股票代码/名称提取
- 行情/研报/研究/模糊指令分类
- 数据源切换与消歧选择解析
- 文件序号与列名选择解析

均为纯函数（只读配置），无副作用；mcp_server.py 通过 `from routing import *`
沿用原有调用点（含测试），无行为变化。
"""

import json
import re

import paths

# ==================== Phase 8: 意图路由与消歧 ====================

_TIME_HISTORICAL_WORDS = ("历史", "过去", "财报", "研报", "年报", "季报", "去年", "今年",
                          "往年", "近三年", "过去三年", "年度", "回顾")
_TIME_REALTIME_WORDS = ("现在", "当前", "实时", "最新", "现价", "今天", "多少钱", "股价", "行情", "价格")
_MARKET_VERBS = ("分析", "多少钱", "股价", "价格", "行情", "涨", "跌", "现价", "估值",
                 "走势", "如何", "怎么样", "投资", "值不值", "贵", "便宜", "买", "卖")
_SKIP_MARKET = ("添加", "入库", "清洗", "画", "统计", "报告", "生成", "读文件", "读取文件")

_MARKET_NAMES = {
    "贵州茅台": "sh600519", "茅台": "sh600519",
    "五粮液": "sz000858",
    "山西汾酒": "sh600809", "泸州老窖": "sz000568", "洋河股份": "sz002304",
    "古井贡酒": "sz000596", "伊利股份": "sh600887", "海天味业": "sh603288",
    "宁德时代": "sz300750",
    "比亚迪": "sz002594",
    "隆基绿能": "sh601012", "通威股份": "sh600438", "中芯国际": "sh688981",
    "恒瑞医药": "sh600276", "药明康德": "sh603259", "迈瑞医疗": "sz300760",
    "片仔癀": "sh600436", "云南白药": "sz000538", "长江电力": "sh600900",
    "中国中免": "sh601888", "东方财富": "sz300059", "同花顺": "sz300033",
    "中国平安": "sh601318", "中信证券": "sh600030", "招商银行": "sh600036",
    "平安银行": "sz000001", "工商银行": "sh601398", "建设银行": "sh601939",
    "农业银行": "sh601288", "中国银行": "sh601988", "交通银行": "sh601328",
    "兴业银行": "sh601166", "浦发银行": "sh600000", "民生银行": "sh600016",
    "万科": "sz000002", "保利发展": "sh600048", "美的集团": "sz000333",
    "格力电器": "sz000651", "海尔智家": "sh600690",
    "三一重工": "sh600031", "工业富联": "sh601138", "京东方": "sz000725",
    "中国石油": "sh601857", "中国石化": "sh600028", "中国神华": "sh601088",
    "中国移动": "sh600941", "中国联通": "sh600050", "中国电信": "sh601728",
    "中远海控": "sh601919", "顺丰控股": "sz002352", "中国建筑": "sh601668",
    "腾讯": "hk00700", "阿里巴巴": "hk09988", "阿里": "hk09988",
    "美团": "hk03690", "小米": "hk01810", "快手": "hk01024", "网易": "hk09999",
    "苹果": "AAPL", "特斯拉": "TSLA", "英伟达": "NVDA",
    "微软": "MSFT", "谷歌": "GOOGL", "亚马逊": "AMZN", "Meta": "META",
    "京东": "JD", "拼多多": "PDD", "百度": "BIDU",
    "蔚来": "NIO", "理想": "LI", "小鹏": "XPEV",
}


def _get_market_names():
    """合并内置股票名称表 + config.json 的 market_names 扩展（可覆盖默认）。"""
    try:
        with open(paths.CONFIG_FILE, encoding="utf-8") as f:
            cfg = json.load(f)
        extra = (cfg or {}).get("market_names") or {}
        names = dict(_MARKET_NAMES)
        names.update(extra)
        return names
    except Exception:
        return _MARKET_NAMES


def _detect_time_intent(query):
    """时间意图：历史关键词优先（避免“历史行情”被误判为实时）。"""
    for w in _TIME_HISTORICAL_WORDS:
        if w in query:
            return "historical"
    for w in _TIME_REALTIME_WORDS:
        if w in query:
            return "realtime"
    return None


def _extract_market_symbol(query):
    """从语句中提取股票代码或常见股票名称。返回 (symbol, name) 或 (None, None)。"""
    m = re.search(r"\b(?:sh|sz|hk|us|bj)\d{2,6}\b", query, re.I)
    if m:
        return m.group(0).lower(), m.group(0).upper()
    m = re.search(r"\b(\d{6})\b", query)
    if m:
        return m.group(1), m.group(1)
    for name, code in _get_market_names().items():
        if name in query:
            return code, name
    return None, None


def _is_market_query(query):
    """判断是否属于行情类指令（避免误伤“添加到知识库/画图/清洗”等其它意图）。"""
    if any(s in query for s in _SKIP_MARKET):
        return False
    symbol, _ = _extract_market_symbol(query)
    if not symbol:
        return False
    return any(v in query for v in _MARKET_VERBS)


def _is_historical_report_query(query):
    """历史财报/研报类查询：命中股票 + 历史时间意图 + 财报类关键词时，
    直接走 RAG 知识库，避免被通用 LLM 兜底或误判为实时行情。"""
    if any(s in query for s in ("读", "打开", "搜索", "路径", "文件", "下载", "保存")):
        return False
    symbol, _ = _extract_market_symbol(query)
    if not symbol:
        return False
    if _detect_time_intent(query) != "historical":
        return False
    return any(k in query for k in (
        "财报", "年报", "半年报", "季报", "研报", "公告",
        "历史行情", "历史数据", "历史走势", "基本面", "营收", "净利润", "毛利率",
    ))


def _is_research_query(query):
    """研究报告类指令：命中关键词且能提取股票时触发 Agentic 研究代理。"""
    if not any(k in query for k in ("研究报告", "投资报告", "出一份", "写报告", "研究一下")):
        return False
    symbol, _ = _extract_market_symbol(query)
    return symbol is not None


def _parse_ambiguity_choice(query):
    """解析消歧选择：回复 1/2 或“实时/历史”。"""
    q = query.strip()
    if q in ("1", "2") or re.fullmatch(r"[12][.、)）]?", q):
        return 1 if q[0] == "1" else 2
    if re.search(r"(选|要|用|看)?\s*实时", q) and "历史" not in q:
        return 1
    if re.search(r"(选|要|用|看)?\s*历史", q) and "实时" not in q:
        return 2
    return None


def _parse_source_switch(query):
    """解析数据源切换指令（优先级高于普通指令）。"""
    if re.search(r"切换\s*(到)?\s*(实时|行情|当前)|用实时|看实时", query):
        return "realtime"
    if re.search(r"切换\s*(到)?\s*(历史|研报|知识库|财报)|历史分析|看研报|用知识库", query):
        return "historical"
    return None


def _is_vague_query(query):
    """判断用户指令是否意图模糊（无明确操作词）。"""
    q = query.strip()
    if not q:
        return True
    action_words = ("读", "画", "分析", "统计", "搜索", "查", "清洗", "报告", "行情",
                    "知识库", "回归", "相关", "趋势", "图", "打开", "添加", "切换", "生成")
    if any(m in q for m in ("这个", "那个", "看看")) and not any(a in q for a in action_words):
        return True
    if len(q) <= 4 and not any(a in q for a in action_words):
        return True
    return False


def _parse_file_index(query: str):
    """从用户语句中解析文件序号，返回 0 基索引；无法判断时返回 None。"""
    # 阿拉伯数字：第N个 / 用N个 / 选N个 / N号文件 / 文件N
    patterns = (
        r'第\s*(\d+)\s*个',
        r'用\s*(\d+)\s*个',
        r'选\s*(\d+)\s*个',
        r'(\d+)\s*号\s*文件',
        r'文件\s*(\d+)',
        r'^\s*(\d+)\s*$',  # 整句就是数字（如 "1"），与行情歧义选择的裸数字风格保持一致
    )
    for pattern in patterns:
        match = re.search(pattern, query)
        if match:
            return int(match.group(1)) - 1
    # 中文数字：第X个 / 用X个 / 选X个
    cn_num = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
    cn_match = re.search(r'(?:第|用|选)\s*([一二两三四五六七八九十]+)\s*个', query)
    if cn_match:
        word = cn_match.group(1)
        if word == "十":
            return 9
        if "十" in word:
            head, _, tail = word.partition("十")
            return (cn_num.get(head, 1) * 10 + cn_num.get(tail, 0)) - 1
        return (cn_num.get(word, 0) - 1) if word in cn_num else None
    # 兜底：回复里只有纯数字时才当作序号（如直接回复 "1"），避免误判 "第1季度" 这类语句
    stripped = query.strip()
    if stripped.isdigit() and len(stripped) <= 3:
        return int(stripped) - 1
    return None


def _pick_columns(query: str, columns, numeric_columns):
    if not columns:
        return None, None
    matches = [c for c in columns if c and c in query]
    if len(matches) >= 2:
        return matches[0], matches[1]
    if len(matches) == 1:
        col = matches[0]
        if col in numeric_columns:
            x_candidates = [c for c in columns if c != col]
            return (x_candidates[0] if x_candidates else col), col
        y_candidates = [c for c in numeric_columns if c != col]
        y = y_candidates[0] if y_candidates else (columns[1] if len(columns) > 1 else col)
        return col, y
    x = columns[0]
    y_candidates = [c for c in numeric_columns if c != x]
    y = y_candidates[0] if y_candidates else (columns[1] if len(columns) > 1 else x)
    return x, y
