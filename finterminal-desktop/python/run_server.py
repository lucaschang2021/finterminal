"""pyinstaller 打包入口：启动 FinTerminal HTTP API 服务。

用法：finterminal-backend.exe [--port 8000]
"""

import os
import sys

import uvicorn


def main():
    port = int(os.environ.get("FIN_BACKEND_PORT", "8000"))
    if "--port" in sys.argv:
        try:
            port = int(sys.argv[sys.argv.index("--port") + 1])
        except (IndexError, ValueError):
            pass
    # 打包模式：把数据目录指到 exe 同级的 data/（可写、持久），避免写进一次性解压目录
    if getattr(sys, "frozen", False):
        from pathlib import Path
        data_dir = Path(os.environ.get("FIN_DATA_DIR") or (Path(sys.executable).resolve().parent / "data"))
        data_dir.mkdir(parents=True, exist_ok=True)
        os.environ["FIN_DATA_DIR"] = str(data_dir)
    import api_server
    # 显式创建 Server，并把实例注入 api_server，使 /api/shutdown 能触发优雅退出
    # （进程正常结束 → PyInstaller 清理 _MEI* 临时目录，避免 Temp 残留累积）
    server = uvicorn.Server(uvicorn.Config(api_server.app, host="127.0.0.1", port=port, log_level="warning"))
    api_server.set_server(server)
    server.run()


if __name__ == "__main__":
    main()
