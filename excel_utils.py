"""Excel 读取工具：保留公式字符串，避免 pandas 将公式单元格静默读成 NaN。

pandas.read_excel 会把以 = 开头的公式单元格读成 NaN（公式无缓存值时），
导致数据清洗/分析/数据链对比时静默丢失内容。
本模块用 openpyxl(data_only=False) 读取 .xlsx，公式以原始字符串保留。
"""


def _dedup(cols):
    """重复表头按 pandas 惯例加 .N 后缀（x, x.1, x.2）。"""
    seen = {}
    out = []
    for c in cols:
        if c in seen:
            seen[c] += 1
            out.append(f"{c}.{seen[c]}")
        else:
            seen[c] = 0
            out.append(c)
    return out


def read_xlsx(path, sheet=0):
    """用 openpyxl(data_only=False) 读取 .xlsx，公式单元格以原始字符串保留。

    参数:
        path: .xlsx 文件路径（支持解密后的临时文件）。
        sheet: sheet 名或从 0 开始的序号，默认第一个 sheet。
    返回:
        pandas.DataFrame；缺失表头按 pandas 惯例命名为 Unnamed: N。
    """
    import openpyxl
    import pandas as pd

    wb = openpyxl.load_workbook(path, data_only=False, read_only=True)
    try:
        ws = wb[sheet] if isinstance(sheet, str) else wb.worksheets[sheet]
        rows_iter = ws.iter_rows(values_only=True)
        header = next(rows_iter, None)
        if header is None:
            return pd.DataFrame()
        cols = [str(h) if h is not None else f"Unnamed: {i}" for i, h in enumerate(header)]
        rows = list(rows_iter)
    finally:
        wb.close()
    if len(set(cols)) != len(cols):
        cols = _dedup(cols)
    return pd.DataFrame(rows, columns=cols)
