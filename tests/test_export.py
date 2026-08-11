# -*- coding: utf-8 -*-
"""报告导出测试。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import export_utils as eu


def test_docx_and_pdf(tmp_path):
    md = ("# 报告\n\n**粗体**段落。\n\n| 指标 | 值 |\n|---|---|\n| 营收 | 1500亿 |\n\n"
          "- 要点一\n- 要点二\n")
    d = str(tmp_path / "t.docx")
    p = str(tmp_path / "t.pdf")
    eu.to_docx(md, d)
    eu.to_pdf(md, p)
    assert os.path.getsize(d) > 500
    assert os.path.getsize(p) > 500
