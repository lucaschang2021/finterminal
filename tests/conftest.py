# -*- coding: utf-8 -*-
"""pytest 共享夹具与测试环境自愈钩子。

1. isolate_runtime_dirs：把数据链/知识库/行情缓存目录重定向到临时目录，
   避免测试污染项目目录（曾导致 chroma 文件锁残留与在线测试数据串扰）。
2. pytest_configure 自愈：
   - basetemp 每次运行使用唯一时间戳子目录（不再固定 .pytest-tmp2）；
   - 启动时清理残留旧目录；
   - basetemp 根目录损坏（ACL 被破坏/沙箱锁定）时自动回退到系统临时目录；
   - 探测 0o700 目录在当前环境是否可访问，不可访问时把 pytest 目录创建
     mode 降级为 0o755（DSH 沙箱等环境下 `mkdir(mode=0o700)` 的目录会立即
     无法读写，导致整轮测试 setup 失败）。
"""

import os
import shutil
import sys
import tempfile
import time

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)


def _pick_basetemp_root():
    """返回可写的 basetemp 根目录：优先项目内 .pytest-tmp，损坏时回退系统临时目录。"""
    preferred = os.path.join(PROJECT_ROOT, ".pytest-tmp")
    try:
        os.makedirs(preferred, exist_ok=True)
        probe = os.path.join(preferred, f"probe_root_{os.getpid()}")
        os.makedirs(probe, exist_ok=True)
        shutil.rmtree(probe, ignore_errors=True)
        return preferred
    except (PermissionError, OSError):
        # 项目内目录 ACL 损坏/被锁 → 用系统临时目录（沙箱 temp 可写）
        fallback = os.path.join(tempfile.gettempdir(), "finterminal-pytest")
        os.makedirs(fallback, exist_ok=True)
        return fallback


def pytest_configure(config):
    """测试环境自愈：唯一 basetemp + 残留清理 + 目录 mode 降级。"""
    # ---- 1) 唯一 basetemp：每次运行独立时间戳子目录，避免旧目录 ACL 损坏阻塞 ----
    root = _pick_basetemp_root()
    run_dir = os.path.join(root, "run_" + time.strftime("%Y%m%d_%H%M%S") + f"_{os.getpid()}")
    config.option.basetemp = run_dir

    # ---- 2) 启动时清理残留旧目录（ignore_errors：ACL 损坏时跳过，不阻塞本轮） ----
    try:
        now = time.time()
        for name in os.listdir(root):
            old = os.path.join(root, name)
            if not os.path.isdir(old) or not name.startswith("run_"):
                continue
            # 清理超过 7 天的旧运行目录；失败（ACL 损坏等）时静默跳过
            try:
                if now - os.path.getmtime(old) > 7 * 86400:
                    shutil.rmtree(old, ignore_errors=True)
            except OSError:
                pass
    except OSError:
        pass

    # ---- 3) 目录 mode 降级探测：0o700 目录在部分环境（Windows 沙箱）不可访问 ----
    # 探测必须在与 pytest basetemp 相同的位置进行：沙箱对 temp 与 workspace 的
    # 权限策略不同，用 tempfile 探测得到的结果与 pytest 实际 basetemp 不一致。
    try:
        probe_dir = os.path.join(root, "probe_" + str(os.getpid()))
        os.makedirs(probe_dir, exist_ok=True)
        probe_sub = os.path.join(probe_dir, "sub")
        degraded = False
        try:
            os.mkdir(probe_sub, mode=0o700)
        except (PermissionError, OSError):
            degraded = True  # 连 0o700 目录都无法创建
        if not degraded:
            try:
                os.listdir(probe_sub)  # 0o700 目录创建后可能立即不可读
            except (PermissionError, OSError):
                degraded = True
        shutil.rmtree(probe_dir, ignore_errors=True)

        if degraded:
            # 0o700 目录不可用 → 把 pytest 所有目录创建 mode 降级为 0o755
            import _pytest.pathlib as pl
            import _pytest.tmpdir as td

            orig_make = pl.make_numbered_dir

            def make_patched(root, prefix, mode=0o755):
                return orig_make(root, prefix, mode)

            pl.make_numbered_dir = make_patched
            td.make_numbered_dir = make_patched  # tmpdir 模块内 re-export 的引用

            orig_mktemp = td.TempPathFactory.mktemp

            def mktemp_patched(self, basename, numbered=False):
                if numbered:
                    return td.make_numbered_dir(root=self.getbasetemp(), prefix=basename, mode=0o755)
                p = self.getbasetemp().joinpath(basename)
                p.mkdir(mode=0o755)
                return p

            td.TempPathFactory.mktemp = mktemp_patched

            orig_getbasetemp = td.TempPathFactory.getbasetemp

            def getbasetemp_patched(self):
                if self._basetemp is not None:
                    return self._basetemp
                if self._given_basetemp is not None:
                    basetemp = self._given_basetemp
                    if basetemp.exists():
                        pl.rm_rf(basetemp)
                    basetemp.mkdir(mode=0o755)
                    basetemp = basetemp.resolve()
                    self._basetemp = basetemp
                    self._trace("new basetemp", basetemp)
                    return basetemp
                return orig_getbasetemp(self)

            td.TempPathFactory.getbasetemp = getbasetemp_patched
    except Exception:
        # 探测失败时保持 pytest 默认行为，不影响测试运行
        pass


@pytest.fixture(autouse=True)
def isolate_runtime_dirs(tmp_path, monkeypatch):
    """每个测试使用独立的临时运行目录，并重置各模块的单例状态。"""
    import data_chain as dc
    import knowledge as kb
    import market_data as md

    base = tmp_path / "runtime"
    dc.CHAIN_DIR = base / "data_chain"
    dc.LEDGER_FILE = dc.CHAIN_DIR / "ledger.json"
    dc.TRACK_FILE = dc.CHAIN_DIR / "tracked.json"
    dc.SNAPSHOT_DIR = dc.CHAIN_DIR / "snapshots"
    dc.CLEANUP_FILE = dc.CHAIN_DIR / "cleanup.json"
    dc.ARCHIVE_DIR = dc.CHAIN_DIR / "archive"
    dc.ANCHOR_FILE = dc.CHAIN_DIR / "anchors.json"

    kb.KNOWLEDGE_DIR = base / "knowledge"
    kb._client = None
    kb._collection = None
    kb._embedder = None
    kb._bm25 = None

    md.CACHE_DIR = base / "cache"
    return base
