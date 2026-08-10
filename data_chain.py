# -*- coding: utf-8 -*-
"""
数据链模块（FinTerminal）
========================
文件变更历史记录 + 哈希链（区块链基础）。

设计：
- 每次检测到文件变化，都会生成一条「区块」记录（index / timestamp / prev_hash / data / record_hash）。
- 每条记录的 prev_hash 指向上一条记录的 record_hash，形成不可篡改的哈希链。
- 每次变化同时保存一份文件快照，用于精确对比「具体改了什么」和日后恢复。
- 提供校验工具，可随时验证整条链的完整性。

存储结构：
data_chain/
  ledger.json          # 账本（区块记录数组 + 链头哈希）
  tracked.json         # 手动登记跟踪的文件/目录
  snapshots/           # 每次变化后的文件快照副本
  archive/             # 按策略归档的旧快照
  cleanup.json         # 清理登记（哪些快照已归档 / 已删除）
"""

# ==================== Phase 4: 数据链（文件变更历史） ====================

import datetime
import difflib
import hashlib
import json
import os
import shutil
import threading
import uuid
from pathlib import Path

import pandas as pd

CHAIN_DIR = Path(__file__).parent / "data_chain"
LEDGER_FILE = CHAIN_DIR / "ledger.json"
TRACK_FILE = CHAIN_DIR / "tracked.json"
SNAPSHOT_DIR = CHAIN_DIR / "snapshots"
CLEANUP_FILE = CHAIN_DIR / "cleanup.json"
ARCHIVE_DIR = CHAIN_DIR / "archive"
ANCHOR_FILE = CHAIN_DIR / "anchors.json"

GENESIS_HASH = "0" * 64

DATA_EXTS = (".csv", ".xlsx", ".xls")
TEXT_EXTS = (".txt", ".json", ".md", ".py", ".log", ".ini", ".cfg", ".yaml", ".yml", ".toml", ".xml")

DIFF_CELL_LIMIT = 50       # 表格差异最多展示的单元格/行数
DIFF_LINE_LIMIT = 200      # 文本差异最多展示的行数
TABLE_ROW_LIMIT = 5000     # 超过该行数不做逐行对比，只记录概要

# 数据链写入锁：防止并发调用（多个工具同时触发记录）导致账本损坏或丢记录
_CHAIN_LOCK = threading.Lock()


def _encrypt_enabled():
    """快照加密开关：环境变量 FIN_SNAP_ENCRYPT=1 或 config.json 的 encrypt_snapshots=true。"""
    if os.environ.get("FIN_SNAP_ENCRYPT", "").lower() in ("1", "true", "yes"):
        return True
    try:
        import json
        cfg = json.load(open(Path(__file__).parent / "config.json", encoding="utf-8"))
        return bool(cfg.get("encrypt_snapshots", False))
    except Exception:
        return False


# ==================== 基础工具 ====================

def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _sha256_file(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _snapshot_plain_hash(path, encrypted):
    """计算快照的明文哈希：加密快照先解密再哈希，与 file_hash_after 可比对。"""
    if encrypted:
        with open(path, "rb") as f:
            raw = f.read()
        import crypto_utils
        return hashlib.sha256(crypto_utils.decrypt_bytes(raw)).hexdigest()
    return _sha256_file(path)


def _canonical(path: str) -> str:
    return os.path.normcase(os.path.abspath(os.path.normpath(path)))


def _load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
    return default


def _save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _load_ledger():
    ledger = _load_json(LEDGER_FILE, {"records": []})
    if not isinstance(ledger.get("records"), list):
        ledger["records"] = []
    if "genesis_hash" not in ledger:
        ledger["genesis_hash"] = GENESIS_HASH
    return ledger


def _save_ledger(ledger):
    _save_json(LEDGER_FILE, ledger)


def _load_cleanup():
    """读取清理登记表：记录哪些快照已归档（含归档路径）、哪些已删除。"""
    data = _load_json(CLEANUP_FILE, {"archived": {}, "pruned": []})
    if not isinstance(data.get("archived"), dict):
        data["archived"] = {}
    if not isinstance(data.get("pruned"), list):
        data["pruned"] = []
    return data


def _save_cleanup(data):
    _save_json(CLEANUP_FILE, data)


def _load_anchors():
    data = _load_json(ANCHOR_FILE, {"anchors": []})
    if not isinstance(data.get("anchors"), list):
        data["anchors"] = []
    return data


def _save_anchors(data):
    _save_json(ANCHOR_FILE, data)


def _record_hash(record) -> str:
    payload = {k: v for k, v in record.items() if k != "record_hash"}
    canon = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def _detect_encoding(path) -> str:
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb2312", "latin-1"):
        try:
            with open(path, "r", encoding=enc) as f:
                f.read()
            return enc
        except UnicodeDecodeError:
            continue
    return "utf-8-sig"


def _last_record_for(ledger, path):
    for rec in reversed(ledger.get("records", [])):
        if rec.get("file") == path:
            return rec
    return None


def _new_id() -> str:
    return "rec_" + uuid.uuid4().hex[:10]


def _snapshot_path(ref):
    """把记录里的快照引用解析为绝对路径。

    新版账本存相对路径（snapshots/xxx），兼容旧版存绝对路径的记录。
    """
    p = Path(str(ref))
    if p.is_absolute():
        return str(p)
    return str((CHAIN_DIR / p).resolve())


# ==================== 差异计算 ====================

def _read_table(path):
    ext = Path(path).suffix.lower()
    if ext == ".csv":
        enc = _detect_encoding(path)
        with open(path, "r", encoding=enc) as f:
            first_line = f.readline()
        sep = next((s for s in [",", ";", "\t", "|"] if s in first_line), ",")
        return pd.read_csv(path, encoding=enc, sep=sep, engine="python")
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(path)
    return None


def _cell_changed(old_v, new_v):
    """单元格是否发生变化：任一侧带小数点时按数值比较（100 与 100.0 视为相同），
    否则按字符串比较（保留编号类前导零的差异，如 001 与 1 视为不同）。"""
    a, b = str(old_v), str(new_v)
    if "." in a or "." in b:
        try:
            return float(a) != float(b)
        except ValueError:
            pass
    return a != b


def _table_diff(old_path, new_path):
    try:
        old_df = _read_table(old_path)
        new_df = _read_table(new_path)
    except Exception:
        return None

    if old_df is None or new_df is None:
        return None

    if len(old_df) > TABLE_ROW_LIMIT or len(new_df) > TABLE_ROW_LIMIT:
        return {
            "summary": f"表格过大，仅记录行数变化（{len(old_df)} → {len(new_df)}）",
            "rows_before": len(old_df),
            "rows_after": len(new_df),
        }

    old_cols = [str(c) for c in old_df.columns]
    new_cols = [str(c) for c in new_df.columns]
    cols_added = [c for c in new_cols if c not in old_cols]
    cols_removed = [c for c in old_cols if c not in new_cols]

    old_rows = [tuple(str(v) for v in row) for row in old_df.itertuples(index=False, name=None)]
    new_rows = [tuple(str(v) for v in row) for row in new_df.itertuples(index=False, name=None)]

    sm = difflib.SequenceMatcher(a=old_rows, b=new_rows, autojunk=False)
    added, removed, modified = [], [], []
    old_col_index = {c: i for i, c in enumerate(old_cols)}

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                old_row = old_rows[i1 + k]
                new_row = new_rows[j1 + k]
                cells = []
                for col_idx, col in enumerate(new_cols):
                    if col in old_col_index:
                        old_v = old_row[old_col_index[col]]
                        new_v = new_row[col_idx] if col_idx < len(new_row) else ""
                        if _cell_changed(old_v, new_v):
                            cells.append({"column": col, "before": old_v, "after": new_v})
                if cells:
                    modified.append({"row": i1 + k + 1, "cell_count": len(cells), "cells": cells[:DIFF_CELL_LIMIT]})
        elif tag == "delete":
            for k in range(i1, i2):
                removed.append({"row": k + 1, "content": list(old_rows[k])})
        elif tag == "insert":
            for k in range(j1, j2):
                added.append({"row": j1 + k + 1, "content": list(new_rows[k])})
        elif tag == "replace":
            if i2 - i1 == j2 - j1:
                # 行数相同：按位置对齐做单元格级对比，避免"整行删除+新增"的噪音
                for k in range(i2 - i1):
                    old_row = old_rows[i1 + k]
                    new_row = new_rows[j1 + k]
                    cells = []
                    for col_idx, col in enumerate(new_cols):
                        if col in old_col_index:
                            old_v = old_row[old_col_index[col]]
                            new_v = new_row[col_idx] if col_idx < len(new_row) else ""
                            if _cell_changed(old_v, new_v):
                                cells.append({"column": col, "before": old_v, "after": new_v})
                    if cells:
                        modified.append({"row": i1 + k + 1, "cell_count": len(cells), "cells": cells[:DIFF_CELL_LIMIT]})
            else:
                for k in range(i1, i2):
                    removed.append({"row": k + 1, "content": list(old_rows[k])})
                for k in range(j1, j2):
                    added.append({"row": j1 + k + 1, "content": list(new_rows[k])})

    added = added[:DIFF_CELL_LIMIT]
    removed = removed[:DIFF_CELL_LIMIT]
    modified = modified[:DIFF_CELL_LIMIT]

    summary = f"新增 {len(added)} 行、删除 {len(removed)} 行、修改 {len(modified)} 行"
    if cols_added or cols_removed:
        summary += f"，列变更（新增 {cols_added} / 删除 {cols_removed}）"

    return {
        "summary": summary,
        "added_rows": added,
        "removed_rows": removed,
        "modified_rows": modified,
        "columns_added": cols_added,
        "columns_removed": cols_removed,
        "rows_before": len(old_df),
        "rows_after": len(new_df),
    }


def _text_diff(old_path, new_path):
    try:
        with open(old_path, "r", encoding=_detect_encoding(old_path)) as f:
            old_lines = f.read().splitlines()
        with open(new_path, "r", encoding=_detect_encoding(new_path)) as f:
            new_lines = f.read().splitlines()
    except Exception:
        return None

    diff_lines = list(difflib.unified_diff(old_lines, new_lines, fromfile="before", tofile="after", lineterm=""))
    total = len(diff_lines)
    added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))
    preview = "\n".join(diff_lines[:DIFF_LINE_LIMIT])
    return {
        "summary": f"共 {total} 行差异（新增 {added}、删除 {removed}）",
        "diff": preview,
        "diff_truncated": total > DIFF_LINE_LIMIT,
    }


def _compute_diff(path, old_snapshot, last_record):
    ext = Path(path).suffix.lower()
    if ext in DATA_EXTS:
        diff = _table_diff(old_snapshot, path)
        if diff:
            return diff
        return {"summary": "表格解析失败，仅记录哈希与大小变化"}
    if ext in TEXT_EXTS:
        diff = _text_diff(old_snapshot, path)
        if diff:
            return diff
        return {"summary": "文本读取失败，仅记录哈希与大小变化"}
    return {"summary": "二进制/不支持类型，仅记录哈希与大小变化"}


# ==================== 区块构建与追加 ====================

def _build_record(path, action, file_hash, size, last_record, diff):
    return {
        "id": _new_id(),
        "time": _now(),
        "file": path,
        "action": action,  # created / modified / deleted
        "file_hash_before": last_record.get("file_hash_after") if last_record else None,
        "file_hash_after": file_hash,
        "size_before": last_record.get("size_after") if last_record else None,
        "size_after": size,
        "diff": diff,
    }


def _append_record(ledger, record, snapshot_source=None):
    if snapshot_source and os.path.exists(snapshot_source):
        try:
            SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            dest = SNAPSHOT_DIR / f"{record['id']}__{os.path.basename(snapshot_source)}"
            if _encrypt_enabled():
                try:
                    # 加密快照：写入 AES-GCM 密文，内容差异降级为哈希+大小
                    with open(snapshot_source, "rb") as f:
                        plain = f.read()
                    import crypto_utils
                    dest.write_bytes(crypto_utils.encrypt_bytes(plain))
                    record["snapshot_encrypted"] = True
                except Exception:
                    # 密钥不可用等异常：降级为明文快照并打标记，绝不静默丢记录
                    shutil.copy2(snapshot_source, dest)
                    record["snapshot_encrypted_failed"] = True
            else:
                shutil.copy2(snapshot_source, dest)
            # 存相对路径（相对 data_chain/），避免项目目录移动后哈希失效
            record["snapshot"] = "snapshots/" + dest.name
        except Exception:
            # 快照写入失败（磁盘/权限等）：仍追加记录并打标记，绝不静默丢记录
            record["snapshot"] = None
            record["snapshot_failed"] = True

    records = ledger["records"]
    record["index"] = len(records)
    record["prev_hash"] = records[-1]["record_hash"] if records else ledger.get("genesis_hash", GENESIS_HASH)
    record["record_hash"] = _record_hash(record)
    records.append(record)
    ledger["head_hash"] = record["record_hash"]
    _save_ledger(ledger)


# ==================== 核心：检测变化并记录 ====================

def record_if_changed(file_path):
    """检查文件是否发生变化；有变化则写入数据链记录。返回记录或 None。"""
    try:
        return _snapshot_one(file_path)
    except Exception:
        return None


def _snapshot_one(file_path):
    """带锁的入口：串行化账本读写，避免并发损坏。"""
    with _CHAIN_LOCK:
        return _snapshot_one_impl(file_path)


def _snapshot_one_impl(file_path):
    path = _canonical(file_path)
    ledger = _load_ledger()
    last = _last_record_for(ledger, path)

    if not os.path.exists(path):
        if last and last.get("action") != "deleted":
            record = _build_record(path, "deleted", None, None, last, {"summary": "文件被删除"})
            _append_record(ledger, record)
            return record
        return None

    file_hash = _sha256_file(path)
    size = os.path.getsize(path)

    if last is None:
        # 首次记录
        record = _build_record(path, "created", file_hash, size, None, {"summary": "首次记录（初始快照）"})
        _append_record(ledger, record, snapshot_source=path)
        return record

    if last.get("action") == "deleted":
        # 删除后重新创建：与"新建"区分开，便于追溯
        record = _build_record(path, "recreated", file_hash, size, None, {"summary": "删除后重新创建"})
        _append_record(ledger, record, snapshot_source=path)
        return record

    if last.get("file_hash_after") == file_hash:
        return None  # 无变化

    old_snapshot = last.get("snapshot")
    diff = None
    if last.get("snapshot_encrypted"):
        diff = {"summary": "快照已加密，无法做内容差异，仅记录哈希与大小变化"}
    elif old_snapshot:
        abs_old = _snapshot_path(old_snapshot)
        if os.path.exists(abs_old):
            diff = _compute_diff(path, abs_old, last)
    if diff is None:
        diff = {"summary": "无法对比前版本内容，仅记录哈希与大小变化"}

    record = _build_record(path, "modified", file_hash, size, last, diff)
    _append_record(ledger, record, snapshot_source=path)
    return record


# ==================== 登记跟踪 ====================

def _load_tracked():
    data = _load_json(TRACK_FILE, {"paths": []})
    if not isinstance(data.get("paths"), list):
        data["paths"] = []
    return data


def _save_tracked(data):
    _save_json(TRACK_FILE, data)


def track(path):
    """登记要跟踪的文件或目录，加入数据链监控范围。"""
    with _CHAIN_LOCK:
        key = _canonical(path)
        data = _load_tracked()
        if key in data["paths"]:
            return f"已跟踪：{path}"
        data["paths"].append(key)
        _save_tracked(data)
        return f"✅ 已加入跟踪：{path}"


def untrack(path):
    """取消跟踪某个文件或目录。"""
    with _CHAIN_LOCK:
        key = _canonical(path)
        data = _load_tracked()
        if key in data["paths"]:
            data["paths"].remove(key)
            _save_tracked(data)
            return f"✅ 已取消跟踪：{path}"
        return f"未找到跟踪记录：{path}"


def _iter_scope_files(path, recursive=True):
    """把路径展开成文件列表（文件本身或目录下已知类型的文件）。"""
    if os.path.isfile(path):
        return [path]
    if os.path.isdir(path):
        if recursive:
            walker = (os.path.join(root, f) for root, dirs, files in os.walk(path) for f in files)
        else:
            walker = (os.path.join(path, f) for f in os.listdir(path) if os.path.isfile(os.path.join(path, f)))
        return [p for p in walker if Path(p).suffix.lower() in DATA_EXTS + TEXT_EXTS]
    return []


def snapshot(path=None, recursive=True):
    """对文件/目录执行一次变化检查，有变化则写入数据链记录。

    参数:
        path: 文件或目录；None 时检查所有已跟踪路径。
        recursive: 目录是否递归扫描。
    返回: 操作摘要文本。
    """
    paths = [path] if path else _load_tracked().get("paths", [])
    files = []
    for p in paths:
        if os.path.exists(p) or os.path.exists(_canonical(p)):
            files.extend(_iter_scope_files(_canonical(p), recursive=recursive))
        else:
            # 已删除的跟踪文件也要记录
            files.append(_canonical(p))

    seen = set()
    results = []
    for f in files:
        key = _canonical(f)
        if key in seen:
            continue
        seen.add(key)
        rec = _snapshot_one(key)
        if rec is None:
            results.append((key, "无变化"))
        else:
            results.append((key, rec["action"]))

    if not results:
        return "没有可检查的文件（先用 chain_track 登记，或指定 path）"

    lines = [f"📦 数据链快照完成，共检查 {len(results)} 个文件："]
    for f, action in results:
        lines.append(f"  {action}  {f}")
    return "\n".join(lines)


def history(file_path=None):
    """查询数据链历史记录；可按文件路径筛选（支持子串匹配）。"""
    ledger = _load_ledger()
    records = ledger["records"]
    if file_path:
        key = _canonical(file_path)
        records = [r for r in records if key in r.get("file", "")]
    if not records:
        return "数据链中暂无记录"

    lines = [f"📜 数据链历史（共 {len(records)} 条记录）"]
    for rec in reversed(records[-50:]):
        diff_summary = (rec.get("diff") or {}).get("summary", "—")
        lines.append(f"[{rec['index']}] {rec['time']} | {rec['action']} | {rec['file']} | {diff_summary}")
    return "\n".join(lines)


def show(record_id):
    """查看某条记录的详细信息（具体改了什么、哈希、快照位置）。"""
    ledger = _load_ledger()
    for rec in ledger["records"]:
        if rec["id"] == record_id or str(rec.get("index")) == record_id:
            return _format_record(rec)
    return f"未找到记录：{record_id}"


def _format_record(rec):
    """把一条区块记录格式化成可读文本（差异、哈希、快照）。"""
    diff = rec.get("diff") or {}
    cleanup_data = _load_cleanup()
    lines = [
        f"📦 记录 #{rec.get('index', '?')}  {rec.get('id', '?')}",
        f"时间: {rec.get('time', '—')}",
        f"操作: {rec.get('action', '—')}",
        f"文件: {rec.get('file', '—')}",
    ]
    if rec.get("size_before") is not None or rec.get("size_after") is not None:
        before_size = rec.get("size_before")
        after_size = rec.get("size_after")
        if before_size is None:
            lines.append(f"大小: {after_size} 字节")
        elif after_size is None:
            lines.append(f"大小: {before_size} 字节（文件已删除）")
        else:
            lines.append(f"大小: {before_size} → {after_size} 字节")
    lines.append(f"摘要: {diff.get('summary', '—')}")

    for row in diff.get("added_rows", []) or []:
        lines.append(f"  ➕ 第{row['row']}行新增: {row['content']}")
    for row in diff.get("removed_rows", []) or []:
        lines.append(f"  ➖ 第{row['row']}行删除: {row['content']}")
    for row in diff.get("modified_rows", []) or []:
        cell_text = "；".join(f"{c['column']}: {c['before']} → {c['after']}" for c in row.get("cells", [])[:10])
        lines.append(f"  ✏️ 第{row['row']}行修改 ({row.get('cell_count')} 个单元格): {cell_text}")
    if diff.get("diff"):
        lines.append("  差异内容:")
        for l in diff["diff"].splitlines()[:40]:
            lines.append(f"    {l}")

    before_hash = rec.get("file_hash_before") or "—"
    after_hash = rec.get("file_hash_after") or "—"
    lines.append(f"哈希: {before_hash[:16]}… → {after_hash[:16]}…")
    if rec.get("snapshot"):
        snap_abs = _snapshot_path(rec["snapshot"])
        if os.path.exists(snap_abs):
            enc_note = "（已加密）" if rec.get("snapshot_encrypted") else ""
            lines.append(f"快照: {snap_abs}{enc_note}")
        elif rec.get("id") in cleanup_data.get("archived", {}):
            arch_abs = _snapshot_path(cleanup_data["archived"][rec.get("id")])
            enc_note = "（已加密）" if rec.get("snapshot_encrypted") else ""
            lines.append(f"快照（已归档）: {arch_abs}{enc_note}")
        elif rec.get("id") in cleanup_data.get("pruned", []):
            lines.append("快照（已按策略清理）")
        else:
            lines.append(f"快照（缺失）: {rec['snapshot']}")
    lines.append(f"区块哈希: {(rec.get('record_hash') or '—')[:24]}…（prev: {(rec.get('prev_hash') or '—')[:24]}…）")
    return "\n".join(lines)


# ==================== 快照清理 ====================

def anchor(service_url="https://freetsa.org/tsr"):
    """把链头哈希交给 RFC3161 可信时间戳服务公证，形成可第三方验证的时间锚点。"""
    ledger = _load_ledger()
    records = ledger.get("records", [])
    if not records:
        return "数据链为空，无可锚定内容"
    head = ledger["head_hash"]
    try:
        import rfc3161ng
        stamper = rfc3161ng.RemoteTimestamper(service_url, hashname="sha256")
        token = stamper.timestamp(bytes.fromhex(head))
        CHAIN_DIR.mkdir(parents=True, exist_ok=True)
        token_path = CHAIN_DIR / f"anchor_{head[:16]}.tsr"
        token_path.write_bytes(token)
        data = _load_anchors()
        now = datetime.datetime.now().isoformat(timespec="seconds")
        data["anchors"].append({
            "head_hash": head,
            "token": str(token_path),
            "service": service_url,
            "anchored_at": now,
        })
        _save_anchors(data)
        return (f"✅ 链头已锚定到可信时间戳服务（RFC3161）\n"
                f"链头: {head[:24]}…\n时间戳令牌: {token_path}\n公证时间: {now}\n"
                f"第三方可用该 .tsr 文件验证“数据在此时刻前已存在且未被篡改”")
    except Exception as e:
        return f"❌ 锚定失败（需能访问时间戳服务 {service_url}）: {e}"


def cleanup(keep_versions=10, max_age_days=None, archive=True, file_path=None):
    """按策略清理历史快照，控制磁盘占用。

    参数:
        keep_versions: 每个文件保留最近 N 个版本的快照（至少 1）。
        max_age_days: 只清理超过该天数的旧快照（None 表示只看版本数）。
        archive: True 时旧快照移入 archive/ 归档；False 时直接删除。
        file_path: 只清理指定文件；None 表示清理所有文件。

    清理动作登记到 cleanup.json，账本区块本身保持不可变；
    verify 会按登记校验归档快照或跳过已删除快照，不会误报。
    """
    with _CHAIN_LOCK:
        return _cleanup_impl(keep_versions, max_age_days=max_age_days, archive=archive, file_path=file_path)


def _cleanup_impl(keep_versions, max_age_days, archive, file_path):
    """快照清理核心逻辑（在锁内执行）。"""
    ledger = _load_ledger()
    cleanup_data = _load_cleanup()
    records = ledger["records"]

    # 按文件分组，只处理当前仍存在快照文件的记录
    by_file = {}
    for rec in records:
        if rec.get("snapshot") and os.path.exists(_snapshot_path(rec["snapshot"])):
            by_file.setdefault(rec["file"], []).append(rec)

    keep_versions = max(1, int(keep_versions or 1))
    cutoff = None
    if max_age_days:
        cutoff = datetime.datetime.now() - datetime.timedelta(days=int(max_age_days))

    targets = []
    for f, recs in by_file.items():
        if file_path and _canonical(file_path) != f:
            continue
        recs_sorted = sorted(recs, key=lambda r: r["index"])
        newest_ids = {r["id"] for r in recs_sorted[-keep_versions:]}
        for rec in recs_sorted:
            if rec["id"] in newest_ids:
                continue  # 最近 N 版始终保留，保证后续差异对比可用
            if cutoff:
                try:
                    t = datetime.datetime.fromisoformat(rec["time"])
                except Exception:
                    t = None
                if t and t > cutoff:
                    continue
            targets.append(rec)

    if not targets:
        return "无需清理（没有符合策略的旧快照）"

    archived_count = pruned_count = 0
    freed = 0
    policy = f"保留每文件最近 {keep_versions} 版"
    if max_age_days:
        policy += f"，{max_age_days} 天以上"
    lines = [f"🧹 快照清理完成（{policy}）："]

    for rec in targets:
        src = _snapshot_path(rec["snapshot"])
        if not os.path.exists(src):
            continue
        freed += os.path.getsize(src)
        if archive:
            ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
            dest = ARCHIVE_DIR / os.path.basename(src)
            try:
                shutil.move(src, dest)
                cleanup_data["archived"][rec["id"]] = "archive/" + dest.name
                archived_count += 1
                lines.append(f"  📦 归档 #{rec['index']} {rec['id']} → archive/{dest.name}")
            except Exception as e:
                lines.append(f"  ❌ 归档失败 #{rec['index']}: {e}")
        else:
            try:
                os.remove(src)
                if rec["id"] not in cleanup_data["pruned"]:
                    cleanup_data["pruned"].append(rec["id"])
                pruned_count += 1
                lines.append(f"  🗑️ 清理 #{rec['index']} {rec['id']}")
            except Exception as e:
                lines.append(f"  ❌ 清理失败 #{rec['index']}: {e}")

    _save_cleanup(cleanup_data)
    lines.append(f"归档 {archived_count} 个 / 删除 {pruned_count} 个，释放约 {freed / 1024:.1f} KB")
    return "\n".join(lines)


# ==================== 校验增强 ====================

def verify(check_live=True, quick=False):
    """校验数据链完整性，并与磁盘现实对照。

    链内检查：区块哈希能否重算、prev_hash 是否衔接、index 是否连续、
     id 是否重复、账本 head_hash 是否一致。
    快照检查：在库快照哈希一致；已归档快照校验归档文件；
    已按策略清理的快照跳过校验；缺失且未登记的快照视为异常。
    现实对照（check_live=True）：当前文件哈希与最后记录是否一致，
    发现未记录的变更或文件丢失。
    quick=True：只做链结构校验（快、不读快照文件、不查磁盘），
    用于日常快速自检；完整校验请用默认模式。
    """
    ledger = _load_ledger()
    cleanup_data = _load_cleanup()
    records = ledger["records"]
    issues = []
    archived_checked = 0
    pruned_skipped = 0
    seen_ids = set()

    for i, rec in enumerate(records):
        rid = rec.get("id")
        if rid in seen_ids:
            issues.append(f"记录 #{i} id 重复: {rid}")
        seen_ids.add(rid)

        if rec.get("index") != i:
            issues.append(f"记录 #{i} 的 index 不连续（期望 {i}，实际 {rec.get('index')}）")

        recomputed = _record_hash(rec)
        if recomputed != rec.get("record_hash"):
            issues.append(f"记录 #{i} 哈希不匹配（数据被篡改或损坏）")
        if i > 0:
            if rec.get("prev_hash") != records[i - 1].get("record_hash"):
                issues.append(f"记录 #{i} 的 prev_hash 与上一条不衔接（链断裂）")
        else:
            if rec.get("prev_hash") != ledger.get("genesis_hash", GENESIS_HASH):
                issues.append("创世记录 prev_hash 与创世哈希不一致")

        if quick:
            continue  # 快速模式：跳过快照文件哈希与磁盘对照

        fh_after = rec.get("file_hash_after")
        snap = rec.get("snapshot")
        if fh_after and snap:
            snap_abs = _snapshot_path(snap)
            if os.path.exists(snap_abs):
                try:
                    if _snapshot_plain_hash(snap_abs, bool(rec.get("snapshot_encrypted"))) != fh_after:
                        issues.append(f"记录 #{i} 快照内容与记录哈希不符（快照被改动）")
                except Exception:
                    issues.append(f"记录 #{i} 快照无法读取: {snap_abs}")
            elif rid in cleanup_data.get("archived", {}):
                arch = _snapshot_path(cleanup_data["archived"][rid])
                if os.path.exists(arch):
                    try:
                        if _snapshot_plain_hash(arch, bool(rec.get("snapshot_encrypted"))) != fh_after:
                            issues.append(f"记录 #{i} 归档快照内容与记录哈希不符（归档被改动）")
                        else:
                            archived_checked += 1
                    except Exception:
                        issues.append(f"记录 #{i} 归档快照无法读取: {arch}")
                else:
                    issues.append(f"记录 #{i} 归档快照缺失: {arch}")
            elif rid in cleanup_data.get("pruned", []):
                pruned_skipped += 1  # 已按策略清理，跳过哈希校验
            else:
                issues.append(f"记录 #{i} 快照缺失且未登记清理（可能被误删/篡改）: {snap}")

    # 与磁盘现实对照：发现未记录的变更或文件丢失
    if check_live and not quick:
        last_by_file = {}
        for rec in records:
            last_by_file[rec["file"]] = rec
        for f, rec in last_by_file.items():
            if rec.get("action") == "deleted":
                continue
            fh = rec.get("file_hash_after")
            if not fh:
                continue
            if not os.path.exists(f):
                issues.append(f"文件已不存在但最后记录未标记删除: {f}")
            else:
                try:
                    if _sha256_file(f) != fh:
                        issues.append(f"文件当前内容与最后记录不一致（存在未记录的变更）: {f}")
                except Exception:
                    continue

    if records and ledger.get("head_hash") != records[-1].get("record_hash"):
        issues.append("链头 head_hash 与最后一条记录的哈希不一致（链头被篡改）")

    if issues:
        return "❌ 数据链校验发现问题：\n" + "\n".join(issues)
    if not records:
        return "数据链为空，暂无记录"
    parts = [f"✅ 数据链完整（{len(records)} 条记录，链头 {ledger.get('head_hash', '')[:24]}…）"]
    if quick:
        parts.append("快速模式：未校验快照文件与磁盘文件")
    if archived_checked:
        parts.append(f"已校验 {archived_checked} 个归档快照")
    if pruned_skipped:
        parts.append(f"跳过 {pruned_skipped} 个已按策略清理的快照")
    return "\n".join(parts)


def status():
    """数据链整体状态：记录总数、链头哈希、快照/归档/清理统计、跟踪路径。"""
    ledger = _load_ledger()
    records = ledger["records"]
    tracked = _load_tracked().get("paths", [])
    cleanup_data = _load_cleanup()
    anchors = _load_anchors().get("anchors", [])

    snap_count = sum(1 for r in records if r.get("snapshot") and os.path.exists(_snapshot_path(r["snapshot"])))
    arch_count = len(cleanup_data.get("archived", {}))
    pruned_count = len(cleanup_data.get("pruned", []))
    enc_failed = sum(1 for r in records if r.get("snapshot_encrypted_failed"))
    snap_failed = sum(1 for r in records if r.get("snapshot_failed"))

    def _dir_size(d):
        if not os.path.isdir(d):
            return 0
        return sum(
            os.path.getsize(os.path.join(root, f))
            for root, dirs, files in os.walk(d)
            for f in files
        )

    size_kb = (_dir_size(SNAPSHOT_DIR) + _dir_size(ARCHIVE_DIR)) / 1024

    lines = [
        f"📊 数据链状态",
        f"记录总数: {len(records)}",
        f"链头哈希: {ledger.get('head_hash', '—')[:24]}…",
        f"跟踪路径: {len(tracked)} 个",
        f"快照: 在库 {snap_count} 个 / 归档 {arch_count} / 已清理 {pruned_count}（占用约 {size_kb:.1f} KB）",
        f"时间戳锚点: {len(anchors)} 个",
    ]
    if enc_failed:
        lines.append(f"⚠️ 快照加密异常 {enc_failed} 个（密钥不可用，已降级为明文快照，请检查 FIN_ENC_KEY/凭据管理器）")
    if snap_failed:
        lines.append(f"⚠️ 快照写入失败 {snap_failed} 个（记录已保留，快照缺失，请检查磁盘空间与权限）")
    for p in tracked[:20]:
        lines.append(f"  - {p}")
    if records:
        last = records[-1]
        lines.append(f"最新记录: #{last['index']} {last['time']} {last['action']} {last['file']}")
    return "\n".join(lines)


# ==================== MCP 工具注册 ====================

def register_tools(mcp):
    @mcp.tool
    def chain_status():
        """查看数据链整体状态：记录总数、链头哈希、跟踪路径等。"""
        return status()

    @mcp.tool
    def chain_track(path: str):
        """登记要跟踪的文件或目录，加入数据链监控范围。"""
        return track(path)

    @mcp.tool
    def chain_untrack(path: str):
        """取消跟踪某个文件或目录。"""
        return untrack(path)

    @mcp.tool
    def chain_snapshot(path: str = None, recursive: bool = True):
        """检查文件/目录是否有变化，有则写入数据链记录。不传 path 时检查所有已跟踪路径。"""
        return snapshot(path, recursive=recursive)

    @mcp.tool
    def chain_history(file_path: str = None):
        """查询数据链历史记录，可按文件筛选。"""
        return history(file_path)

    @mcp.tool
    def chain_show(record_id: str):
        """查看某条记录的详细信息（具体改了什么、哈希、快照位置）。"""
        return show(record_id)

    @mcp.tool
    def chain_cleanup(keep_versions: int = 10, max_age_days: int = None, archive: bool = True, file_path: str = None):
        """清理历史快照：每文件保留最近 N 版，旧快照可归档（默认）或删除，释放磁盘空间。"""
        return cleanup(keep_versions, max_age_days=max_age_days, archive=archive, file_path=file_path)

    @mcp.tool
    def chain_verify(check_live: bool = True, quick: bool = False):
        """校验数据链完整性：区块哈希、链链接、快照/归档一致性；check_live=True 对照磁盘当前文件；quick=True 只做快速链结构校验（不读快照文件）。"""
        return verify(check_live=check_live, quick=quick)
