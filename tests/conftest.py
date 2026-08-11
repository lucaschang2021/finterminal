# -*- coding: utf-8 -*-
"""pytest 共享夹具：把数据链/知识库/行情缓存目录重定向到临时目录，
避免测试污染项目目录（曾导致 chroma 文件锁残留与在线测试数据串扰）。"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


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
