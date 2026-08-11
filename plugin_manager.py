"""轻量插件系统（FinTerminal）。

plugins/ 目录下每个 .py 模块若定义 register_plugin(ctx) 则被自动加载。
ctx 提供的注册能力：
  - add_provider(kind, fn)：数据源插件（kind: "quote" / "kline"）
  - add_analysis(name, fn)：自定义分析类型（fn(file_path, password) -> 文本）
  - add_chart(name, fn)：自定义图表类型（fn(fig, df, params)）

插件失败不影响主流程；加载失败的插件会被跳过。
"""

import importlib.util
import sys
from pathlib import Path

PLUGIN_DIR = Path(__file__).parent / "plugins"

_registry = {"providers": {}, "analyses": {}, "charts": {}}


class PluginContext:
    def __init__(self, name):
        self.name = name

    def add_provider(self, kind, fn):
        _registry["providers"].setdefault(kind, []).append((self.name, fn))

    def add_analysis(self, name, fn):
        _registry["analyses"][name] = (self.name, fn)

    def add_chart(self, name, fn):
        _registry["charts"][name] = (self.name, fn)


def load_plugins():
    """扫描并加载 plugins/ 目录下的插件。返回成功加载数。"""
    _registry["providers"].clear()
    _registry["analyses"].clear()
    _registry["charts"].clear()
    if not PLUGIN_DIR.exists():
        return 0
    count = 0
    for py in sorted(PLUGIN_DIR.glob("*.py")):
        if py.name.startswith("_"):
            continue
        mod_name = f"finplugin_{py.stem}"
        spec = importlib.util.spec_from_file_location(mod_name, py)
        if not spec or not spec.loader:
            continue
        mod = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = mod
        try:
            spec.loader.exec_module(mod)
            if hasattr(mod, "register_plugin"):
                ctx = PluginContext(py.stem)
                mod.register_plugin(ctx)
                count += 1
        except Exception:
            sys.modules.pop(mod_name, None)
    return count


def get_providers(kind):
    return _registry["providers"].get(kind, [])


def get_analyses():
    return _registry["analyses"]


def get_charts():
    return _registry["charts"]
