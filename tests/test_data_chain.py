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


def test_corrupt_ledger_not_silently_reset(tmp_path):
    """账本损坏时：备份原文件、中止写入，绝不静默重建空链。"""
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
    p = str(tmp_path / "corrupt.csv")
    _write(p, "x\n1\n")
    r1 = dc.record_if_changed(p)
    assert r1 and r1["action"] == "created"
    valid_ledger = dc.LEDGER_FILE.read_text(encoding="utf-8")

    # 模拟账本被写坏
    with open(dc.LEDGER_FILE, "w", encoding="utf-8") as f:
        f.write("{broken json")

    # 再次记录：应中止且不覆盖
    _write(p, "x\n2\n")
    assert dc.record_if_changed(p) is None
    # 原文件已被备份，账本目录里出现 .corrupt-* 备份
    backups = [x for x in dc.CHAIN_DIR.glob("ledger.corrupt-*.json")]
    assert backups, "损坏账本应被备份而非直接丢弃"
    # 损坏原件必须留在原位持续阻断，而不是被移走/重建
    assert dc.LEDGER_FILE.exists()
    assert "账本文件损坏" in dc.status()
    assert "账本文件损坏" in dc.verify(quick=True)
    assert "账本文件损坏" in dc.history()

    # 修复（还原有效账本）后，链仍完整可用
    dc.LEDGER_FILE.write_text(valid_ledger, encoding="utf-8")
    assert "✅" in dc.verify(quick=True)
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)


def test_corrupt_tracked_backed_up(tmp_path):
    """辅助元数据损坏时同样先备份，不静默丢失。"""
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
    dc.CHAIN_DIR.mkdir(parents=True, exist_ok=True)
    with open(dc.TRACK_FILE, "w", encoding="utf-8") as f:
        f.write("not-json")
    assert "已加入跟踪" in dc.track(str(tmp_path / "t.csv"))
    backups = [x for x in dc.CHAIN_DIR.glob("tracked.corrupt-*.json")]
    assert backups
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)


def test_concurrent_multi_file_records(tmp_path):
    """多线程并发记录独立文件：锁串行正确，全部记录且链完整。"""
    import threading

    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
    files = [str(tmp_path / f"f{i}.txt") for i in range(20)]
    for p in files:
        _write(p, "v0\n")
        dc.record_if_changed(p)

    errors = []

    def worker(i):
        try:
            _write(files[i], "v0\nv1\n")
            dc.record_if_changed(files[i])
        except Exception as e:
            errors.append(str(e))

    ths = [threading.Thread(target=worker, args=(i,)) for i in range(20)]
    [t.start() for t in ths]
    [t.join() for t in ths]

    assert not errors, errors[:3]
    recs = dc._load_ledger()["records"]
    assert len(recs) == 40, f"记录数 {len(recs)}"
    assert all(r["index"] == i for i, r in enumerate(recs))
    assert "✅" in dc.verify(quick=True)
    shutil.rmtree(dc.CHAIN_DIR, ignore_errors=True)
