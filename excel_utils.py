"""Excel 读取工具：公式单元格"值优先、无缓存回退公式字符串"。

pandas.read_excel 会把以 = 开头的公式单元格读成 NaN（公式无缓存值时），
导致数据清洗/分析/数据链对比时静默丢失内容。
本模块用 openpyxl 同时读取缓存计算值与公式字符串：
- 公式单元格有缓存计算值（Excel/WPS 保存时通常附带）→ 返回计算值；
- 无缓存值（如程序生成的公式文件）→ 返回公式字符串，既不丢数据也不丢失信息。
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
    """读取 .xlsx：公式单元格优先取缓存计算值，无缓存时保留公式字符串。

    参数:
        path: .xlsx 文件路径（支持解密后的临时文件）。
        sheet: sheet 名或从 0 开始的序号，默认第一个 sheet。
    返回:
        pandas.DataFrame；缺失表头按 pandas 惯例命名为 Unnamed: N。
    """
    import openpyxl
    import pandas as pd

    wb_formulas = openpyxl.load_workbook(path, data_only=False, read_only=True)
    wb_values = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        ws_f = wb_formulas[sheet] if isinstance(sheet, str) else wb_formulas.worksheets[sheet]
        ws_v = wb_values[sheet] if isinstance(sheet, str) else wb_values.worksheets[sheet]
        from itertools import zip_longest

        rows = []
        for row_f, row_v in zip(ws_f.iter_rows(values_only=True), ws_v.iter_rows(values_only=True)):
            cells = []
            for vf, vv in zip_longest(row_f, row_v, fillvalue=None):
                if isinstance(vf, str) and vf.startswith("="):
                    # 公式单元格：优先缓存计算值，无缓存则保留公式字符串
                    cells.append(vv if vv is not None else vf)
                else:
                    cells.append(vf)
            rows.append(cells)
        if not rows:
            return pd.DataFrame()
        header, data = rows[0], rows[1:]
        cols = [str(h) if h is not None else f"Unnamed: {i}" for i, h in enumerate(header)]
    finally:
        wb_formulas.close()
        wb_values.close()
    if len(set(cols)) != len(cols):
        cols = _dedup(cols)
    return pd.DataFrame(data, columns=cols)
