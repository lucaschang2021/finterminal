#!/usr/bin/env python3
"""FinTerminal 后端双副本同步工具（双副本去重）。

背景：仓库同时存在 `finterminal-desktop/python/`（Electron 打包用）与根目录
两份 Python 后端代码。为避免"改了一边没改另一边"，本仓库约定：
**根目录为唯一源码**，桌面端副本一律由本脚本从根目录生成，并做 SHA-256
一致性校验，任何不一致都会立即暴露。

用法：
    python scripts/sync_backend.py            # 同步：根目录 → finterminal-desktop/python/
    python scripts/sync_backend.py --check    # 仅校验一致性，不一致退出码 1（供 pre-commit / CI）

说明：
    - 桌面端特有文件（run_server.py、requirements.txt）不参与同步，保留在桌面端。
    - 根目录新增后端模块后无需改本脚本：顶层 *.py 与 plugins/ 下的 *.py 自动纳入同步。
    - 校验基于 SHA-256，避免内容相同但时间戳/权限不同导致的误报。
"""

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

# Windows GBK console cannot print emoji/CJK -> force UTF-8 output
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent          # 仓库根目录
DEST = ROOT / "finterminal-desktop" / "python"         # 桌面端副本目录

# 不同步到桌面端的根目录顶层文件（桌面端无对应用途）
EXCLUDE_TOP = {"set_api_key.py"}


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_pairs() -> list[tuple[Path, Path]]:
    """收集 (源文件, 目标文件) 同步对。"""
    pairs = []
    for src in sorted(ROOT.glob("*.py")):
        if src.name in EXCLUDE_TOP:
            continue
        pairs.append((src, DEST / src.name))
    for src in sorted((ROOT / "plugins").glob("*.py")):
        pairs.append((src, DEST / "plugins" / src.name))
    # 配置模板也保持同步
    for name in ("config.example.json",):
        src = ROOT / name
        if src.exists():
            pairs.append((src, DEST / name))
    return pairs


def verify() -> list[str]:
    """返回不一致项列表（空 = 一致）。"""
    problems = []
    for src, dst in collect_pairs():
        if not dst.exists():
            problems.append(f"缺失副本: {dst.relative_to(ROOT)}（应运行 sync_backend.py）")
            continue
        if _sha256(src) != _sha256(dst):
            problems.append(f"不一致: {src.relative_to(ROOT)} 与 {dst.relative_to(ROOT)}")
    return problems


def sync() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "plugins").mkdir(parents=True, exist_ok=True)
    copied = 0
    for src, dst in collect_pairs():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied += 1
    problems = verify()
    if problems:
        print("❌ 同步后仍有不一致（不应发生）:", file=sys.stderr)
        for p in problems:
            print(f"   - {p}", file=sys.stderr)
        sys.exit(1)
    print(f"✅ 已同步 {copied} 个文件：根目录 → {DEST.relative_to(ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="仅校验一致性，不复制文件")
    args = parser.parse_args()

    if args.check:
        problems = verify()
        if problems:
            print("❌ 双副本 SHA-256 校验失败：", file=sys.stderr)
            for p in problems:
                print(f"   - {p}", file=sys.stderr)
            print("请运行 `python scripts/sync_backend.py` 同步后重试。", file=sys.stderr)
            return 1
        print("✅ 双副本 SHA-256 校验通过：根目录与 finterminal-desktop/python/ 完全一致")
        return 0

    sync()
    return 0


if __name__ == "__main__":
    sys.exit(main())
