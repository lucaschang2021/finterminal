# -*- coding: utf-8 -*-
"""数据链测试。"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import data_chain as dc


def _write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def test_record_and_verify(tmp_path):
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
    p = str(tmp_path / "a.csv")
    _write(p, "x,y\n1,2\n")
    r1 = dc.record_if_changed(p)
    assert r1 and r1["action"] == "created"
    _write(p, "x,y\n1,2\n3,4\n")
    r2 = dc.record_if_changed(p)
    assert r2 and r2["action"] == "modified" and "新增 1 行" in r2["diff"]["summary"]
    assert "✅" in dc.verify(check_live=False)
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)


def test_snapshot_write_failure_not_silent(tmp_path, monkeypatch):
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)

    def boom(*a, **k):
        raise OSError("模拟写入失败")
    monkeypatch.setattr(dc.shutil, "copy2", boom)
    p = str(tmp_path / "b.csv")
    _write(p, "x\n1\n")
    rec = dc.record_if_changed(p)
    assert rec is not None and rec.get("snapshot_failed") is True
    assert "快照写入失败" in dc.status()
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)


def test_encrypted_fallback(tmp_path, monkeypatch):
    os.environ["FIN_SNAP_ENCRYPT"] = "1"
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
    p = str(tmp_path / "c.csv")
    _write(p, "x\n1\n")
    try:
        rec = dc.record_if_changed(p)
        # 密钥不可用时降级明文并标记，或加密成功——两者都必须保留记录
        assert rec is not None
        if rec.get("snapshot_encrypted_failed"):
            assert "快照加密异常" in dc.status()
    finally:
        os.environ.pop("FIN_SNAP_ENCRYPT", None)
        shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
