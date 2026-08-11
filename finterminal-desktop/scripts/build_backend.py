"""用 pyinstaller 把 Python 后端打包成单个 exe（finterminal-backend.exe）。

用法：python scripts/build_backend.py
产物：build/backend/finterminal-backend.exe（electron-builder 会把它作为 extraResources 打进安装包）
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYTHON_DIR = ROOT / "python"
BUILD_DIR = ROOT / "build"
OUT_DIR = BUILD_DIR / "backend"

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
]


def main():
    cmd = [
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
        "--onefile", "--name", "finterminal-backend",
        "--distpath", str(OUT_DIR),
        "--workpath", str(BUILD_DIR / "pyinstaller_work"),
        "--specpath", str(BUILD_DIR),
    ]
    for h in HIDDEN_IMPORTS:
        cmd += ["--hidden-import", h]
    for m in COPY_METADATA:
        cmd += ["--copy-metadata", m]
    cmd.append(str(PYTHON_DIR / "run_server.py"))

    print("执行:", " ".join(cmd))
    subprocess.check_call(cmd)  # noqa: S603  # 命令为本地固定打包指令，无外部输入
    exe = OUT_DIR / "finterminal-backend.exe"
    if exe.exists():
        print(f"[OK] 后端打包完成: {exe} ({exe.stat().st_size / 1024 / 1024:.1f} MB)")
    else:
        raise SystemExit("打包失败：未找到输出文件")


if __name__ == "__main__":
    main()
