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
    # 知识库（chromadb）运行时用字符串动态导入大量实现类
    # （telemetry / api.rust / sqlite / executor 等），静态分析抓不到；
    # 另外 chromadb_rust_bindings 是 .pyd 二进制，必须显式收集。
    # 统一交给下面的 --collect-* 参数处理，此处保留 onnxruntime
    # （ONNXMiniLM 嵌入模型依赖，之前也是缺失的）。
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
    # chromadb 及其 Rust 绑定的完整收集：所有子模块 + 二进制 + 数据文件
    cmd += ["--collect-submodules", "chromadb"]
    cmd += ["--collect-binaries", "chromadb"]
    cmd += ["--collect-binaries", "chromadb_rust_bindings"]
    cmd += ["--collect-data", "chromadb"]
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
