"""用 pyinstaller 把 Python 后端打包成目录（onedir，免启动解压，秒级启动）。

用法：python scripts/build_backend.py
产物：build/backend/finterminal-backend/（目录，electron-builder 作为 extraResources 打进安装包）

onedir 说明：Windows 260 字符路径限制下，torch 等依赖的 dist-info licenses 目录
过深会导致 COLLECT 复制失败（WinError 206），因此 spec 中过滤超长路径的数据文件，
这些是纯文档，不影响运行。
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYTHON_DIR = ROOT / "python"
BUILD_DIR = ROOT / "build"
OUT_DIR = BUILD_DIR / "backend"
SPEC_FILE = BUILD_DIR / "finterminal-backend.spec"

HIDDEN_IMPORTS = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "fastapi",
    "pydantic",
    "sklearn",
    "openpyxl",
    # 知识库（chromadb）运行时用字符串动态导入大量实现类，静态分析抓不到；
    # chromadb_rust_bindings 是 .pyd 二进制，必须显式收集。统一交给 --collect-*。
    "onnxruntime",
]

# importlib.metadata 运行时查询的包（fastmcp 等），必须把 dist-info 一并打包
COPY_METADATA = [
    "fastmcp",
    "pydantic",
    "pydantic_core",
    "httpx",
    "anyio",
    "starlette",
    "uvicorn",
    "chromadb",
]


def render_spec() -> str:
    hidden = ",\n".join(f"    {m!r}" for m in HIDDEN_IMPORTS)
    meta_lines = "\n".join(f"datas += copy_metadata({m!r})" for m in COPY_METADATA)
    run_server = (PYTHON_DIR / "run_server.py").as_posix()
    return f"""# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files
from PyInstaller.utils.hooks import collect_dynamic_libs
from PyInstaller.utils.hooks import collect_submodules
from PyInstaller.utils.hooks import copy_metadata

datas = []
binaries = []
hiddenimports = [
{hidden}
]
datas += collect_data_files('chromadb')
datas += collect_data_files('akshare')
{meta_lines}
binaries += collect_dynamic_libs('chromadb')
binaries += collect_dynamic_libs('chromadb_rust_bindings')
hiddenimports += collect_submodules('chromadb')
hiddenimports += collect_submodules('akshare')

a = Analysis(
    [{run_server!r}],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

# Windows 路径上限约 260 字符：过滤过深的数据文件（torch licenses 等纯文档），
# 否则 COLLECT 复制时 os.makedirs 报 WinError 206；不影响运行依赖
MAX_PATH = 220
a.datas = [(n, p, t) for (n, p, t) in a.datas if len(n) < MAX_PATH and len(str(p)) < MAX_PATH]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='finterminal-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='finterminal-backend',
)
"""


def main():
    SPEC_FILE.write_text(render_spec(), encoding="utf-8")
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
           "--distpath", str(OUT_DIR),
           "--workpath", str(BUILD_DIR / "pyinstaller_work"),
           str(SPEC_FILE)]
    print("执行:", " ".join(cmd))
    subprocess.check_call(cmd)  # noqa: S603  # 命令为本地固定打包指令，无外部输入
    exe = OUT_DIR / "finterminal-backend" / "finterminal-backend.exe"
    if exe.exists():
        _prune_deep_paths()
        size = sum(f.stat().st_size for f in (OUT_DIR / "finterminal-backend").rglob("*") if f.is_file()) / 1024 / 1024
        print(f"[OK] 后端打包完成: {exe} (目录总大小 {size:.1f} MB)")
    else:
        raise SystemExit("打包失败：未找到输出文件")


def _prune_deep_paths(max_len: int = 200) -> None:
    """删除产物中路径过深的文件（纯文档如 torch LICENSE，不影响运行）。

    Windows 经典路径上限 260 字符：electron-builder 把 extraResources 复制到
    win-unpacked/resources/backend/... 时前缀更长，超深路径会导致整个目录复制失败
    （产物残缺）。这里把绝对路径超过 max_len 的文件删掉，并在构建完成后立即执行。
    """
    import os
    removed = 0
    root = OUT_DIR / "finterminal-backend"
    for f in list(root.rglob("*")):
        if f.is_file() and len(str(f)) > max_len:
            try:
                f.unlink()
                removed += 1
            except OSError:
                pass
    if removed:
        print(f"[prune] 已清理 {removed} 个超深路径文件（>= {max_len} 字符，纯文档类，不影响运行）")


if __name__ == "__main__":
    main()
