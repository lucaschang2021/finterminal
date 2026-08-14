"""共享路径逻辑（FinTerminal）。

数据根目录统一规则：开发模式 = 项目目录；打包模式（frozen）= FIN_DATA_DIR
或 exe 同级的 data/（可写、持久）。onefile 打包后 __file__ 指向一次性解压目录，
数据链/知识库/图表/会话必须落在持久位置。

所有需要定位数据目录的模块（mcp_server / reader / routing / data_chain /
market_data / knowledge …）都应使用本模块，避免各模块自行复制路径逻辑。
"""

import os
import sys
from pathlib import Path


def data_dir() -> Path:
    """返回数据根目录，不存在时自动创建。"""
    env = os.environ.get("FIN_DATA_DIR")
    if env:
        d = Path(env)
    elif getattr(sys, "frozen", False):
        d = Path(sys.executable).resolve().parent / "data"
    else:
        d = Path(__file__).resolve().parent
    d.mkdir(parents=True, exist_ok=True)
    return d


DATA_DIR = data_dir()
CONFIG_FILE = DATA_DIR / "config.json"
