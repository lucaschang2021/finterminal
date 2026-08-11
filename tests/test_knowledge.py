# -*- coding: utf-8 -*-
"""知识库测试（混合检索）。"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["FIN_ENC_KEY"] = "pytest-kb-key-0123456789abcdef"
import knowledge as kb


def test_hybrid_query(tmp_path):
    shutil.rmtree(kb.KNOWLEDGE_DIR, ignore_errors=True)
    p1 = str(tmp_path / "a.txt")
    p2 = str(tmp_path / "b.txt")
    with open(p1, "w", encoding="utf-8") as f:
        f.write("贵州茅台营收1500亿，高端白酒龙头，护城河稳固。")
    with open(p2, "w", encoding="utf-8") as f:
        f.write("新能源汽车销量增长，电池成本下降。")
    kb.add_document(p1)
    kb.add_document(p2)
    res = kb.query("茅台的护城河", top_k=2, hybrid=True)
    assert res and all("综合分" in r for r in res)
    assert "茅台" in res[0]["内容"] or "白酒" in res[0]["内容"]
    shutil.rmtree(kb.KNOWLEDGE_DIR, ignore_errors=True)


def test_hybrid_with_encrypted(tmp_path):
    shutil.rmtree(kb.KNOWLEDGE_DIR, ignore_errors=True)
    os.environ["FIN_KB_ENCRYPT"] = "1"
    p = str(tmp_path / "c.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write("五粮液营收800亿，浓香型白酒龙头。")
    try:
        kb.add_document(p)
        res = kb.query("浓香型白酒", top_k=2, hybrid=True)
        assert any("五粮液" in r["内容"] for r in res)
    finally:
        os.environ["FIN_KB_ENCRYPT"] = "0"
        shutil.rmtree(kb.KNOWLEDGE_DIR, ignore_errors=True)
