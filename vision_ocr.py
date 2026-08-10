# -*- coding: utf-8 -*-
"""
多模态视觉解析模块（FinTerminal）
==================================
识别图片中的文字（OCR，中文/英文）并尝试还原表格/图表数据。

调用方式（经 read 工具）：read(file_path="xxx.png")，自动按扩展名分派。
"""

import os
import re

_ocr = None
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".bmp", ".webp")


def _get_ocr():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr


def is_image(path):
    return os.path.splitext(path)[1].lower() in IMAGE_EXTS


def parse_image(path):
    """解析图片：返回文字、行数、疑似表格数据。"""
    ext = os.path.splitext(path)[1].lower()
    if ext not in IMAGE_EXTS:
        raise ValueError(f"不支持的图片格式: {ext}（支持 {'/'.join(IMAGE_EXTS)}）")
    if not os.path.exists(path):
        raise ValueError(f"图片不存在: {path}")

    ocr = _get_ocr()
    result, _ = ocr(path)
    # 利用 OCR 返回的坐标框，把同一行的文字按从左到右重新拼接，
    # 避免表格列被拆成独立文本框
    boxes = []
    for item in result or []:
        box = item[0]
        text = item[1]
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        boxes.append((sum(ys) / 4, sum(xs) / 4, text))
    boxes.sort(key=lambda b: (b[0], b[1]))

    lines = []
    row_y = None
    row_items = []
    for y, x, text in boxes:
        if row_y is None or abs(y - row_y) > 25:
            if row_items:
                lines.append("  ".join(t[1] for t in sorted(row_items, key=lambda t: t[0])))
            row_y = y
            row_items = [(x, text)]
        else:
            row_items.append((x, text))
    if row_items:
        lines.append("  ".join(t[1] for t in sorted(row_items, key=lambda t: t[0])))

    text = "\n".join(lines)

    # 疑似表格：按分隔符或多空格拆列，≥2 列才收录
    table_rows = []
    for ln in lines:
        cells = [c.strip() for c in re.split(r"[,，;；|\t]\s*|\s{2,}", ln) if c.strip()]
        if len(cells) >= 2:
            table_rows.append(cells)

    return {
        "文本": text,
        "识别行数": len(lines),
        "疑似表格": table_rows[:50],
    }
