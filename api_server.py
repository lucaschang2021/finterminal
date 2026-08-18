"""FinTerminal HTTP API 桥（供 React 前端调用）。

复用 mcp_server 的 8 个工具内部函数，暴露为 REST 接口：
    python -m uvicorn api_server:app --host 127.0.0.1 --port 8000

鉴权：设置环境变量 FIN_API_TOKEN 后启用 Bearer Token 校验（推荐 Electron
生产模式由主进程生成随机 token 注入）；未设置时保持无鉴权（本机开发/兼容旧版）。
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

import mcp_server as m

# charts/ 目录（静态图表文件，serve_chart_file 只允许访问该目录）
# 必须与 mcp_server.CHART_DIR（DATA_DIR/charts）一致：画图写入数据目录，
# 读取也要从同一目录，否则打包版图表读不到（PNG/option.json 404）
CHART_DIR = m.CHART_DIR

app = FastAPI(title="FinTerminal API", version="0.1.0")

# 由 run_server.py 注入 uvicorn.Server 实例；/api/shutdown 通过它触发优雅退出，
# 让 PyInstaller onefile 在进程正常结束前清理 _MEI* 临时解压目录（避免残留累积）。
_server = None

# API Token：为空 = 不启用鉴权；非空 = 所有 /api/* 请求须带
# `Authorization: Bearer <token>` 或 `?token=<token>`（Electron 主进程注入）。
API_TOKEN = os.environ.get("FIN_API_TOKEN", "").strip()


def set_server(server):
    global _server
    _server = server


@app.middleware("http")
async def _token_auth(request, call_next):
    """统一的 Bearer Token 鉴权（FIN_API_TOKEN 非空时生效）。"""
    if API_TOKEN and request.url.path.startswith("/api"):
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer ") and auth[7:].strip() == API_TOKEN:
            return await call_next(request)
        if request.query_params.get("token") == API_TOKEN:
            return await call_next(request)
        return JSONResponse(
            {"ok": False, "error": "未授权：缺少或错误的 API Token（FIN_API_TOKEN）"},
            status_code=401,
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    # 仅绑定 127.0.0.1 的本地回环服务，无 Cookie 会话凭证；
    # 允许任意 Origin 以兼容 Electron 生产模式（file:// 下 Origin 为 null/file://）
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/shutdown")
def shutdown():
    """优雅关闭后端：请求 uvicorn 退出，进程正常结束以触发 PyInstaller 清理。"""
    import threading

    def _stop():
        try:
            if _server is not None:
                _server.should_exit = True
            else:
                import os
                os._exit(0)
        except Exception:
            import os
            os._exit(0)

    threading.Thread(target=_stop, daemon=True).start()
    return _ok(text="正在关闭后端")


def _ok(data=None, text=None):
    return {"ok": True, "data": data, "text": text}


def _err(e):
    return {"ok": False, "error": str(e)}


@app.get("/api/health")
def health():
    return _ok({"service": "FinTerminal", "tools": 8, "charts": sorted(m.charts.supported_types())})


@app.get("/api/files")
def files(path: str = Query(".", description="目录路径")):
    try:
        return _ok(text=m.list_files(path))
    except Exception as e:
        return _err(e)


@app.get("/api/search")
def search(keyword: str | None = None, directory: str | None = None, recursive: bool = False):
    try:
        return _ok(text=m.search_file(keyword, directory, recursive))
    except Exception as e:
        return _err(e)


@app.get("/api/detect")
def detect(path: str):
    try:
        return _ok(text=m.detect(path))
    except Exception as e:
        return _err(e)


@app.get("/api/read")
def read(path: str | None = None, source: str = "local", sheet_name: str | None = None,
         max_pages: int = 3, ocr: bool = True, password: str | None = None,
         days: int = 60, period: str = "daily", fresh: bool = False):
    try:
        if source == "api":
            return _ok(text=m.read(file_path=path, source="api", days=days, period=period, fresh=fresh))
        return _ok(text=m.read(file_path=path, sheet_name=sheet_name, max_pages=max_pages,
                               ocr=ocr, password=password))
    except Exception as e:
        return _err(e)


@app.get("/api/columns")
def columns(path: str):
    """返回数据文件的列名与数值列（图表页选择 x/y 轴用）。"""
    try:
        cols, num_cols = m._detect_columns(path)
        return _ok({"columns": cols, "numeric": num_cols})
    except Exception as e:
        return _err(e)


@app.get("/api/plot/data")
def plot_data(chart_type: str, path: str, x_column: str | None = None, y_column: str | None = None,
              y_columns: str | None = None, value_column: str | None = None,
              open_column: str | None = None, high_column: str | None = None,
              low_column: str | None = None, close_column: str | None = None,
              size_column: str | None = None, error_column: str | None = None,
              title: str | None = None, source: str = "local", days: int = 60, period: str = "daily"):
    try:
        result = m.plot_chart(chart_type, path, x_column=x_column, y_column=y_column,
                              y_columns=y_columns, value_column=value_column,
                              open_column=open_column, high_column=high_column,
                              low_column=low_column, close_column=close_column,
                              size_column=size_column, error_column=error_column,
                              title=title, source=source, days=days, period=period,
                              return_data=True)
        if isinstance(result, dict) and "error" in result:
            return _err(result["error"])
        return _ok(result)
    except Exception as e:
        return _err(e)


@app.get("/api/plot/save")
def plot_save(chart_type: str, path: str, x_column: str | None = None, y_column: str | None = None,
              y_columns: str | None = None, value_column: str | None = None,
              open_column: str | None = None, high_column: str | None = None,
              low_column: str | None = None, close_column: str | None = None,
              size_column: str | None = None, error_column: str | None = None,
              title: str | None = None, source: str = "local", days: int = 60, period: str = "daily"):
    try:
        return _ok(text=m.plot_chart(chart_type, path, x_column=x_column, y_column=y_column,
                                     y_columns=y_columns, value_column=value_column,
                                     open_column=open_column, high_column=high_column,
                                     low_column=low_column, close_column=close_column,
                                     size_column=size_column, error_column=error_column,
                                     title=title, source=source, days=days, period=period))
    except Exception as e:
        return _err(e)


class CleanReq(BaseModel):
    file_path: str
    save: bool = False
    password: str | None = None


@app.post("/api/clean")
def clean(req: CleanReq):
    try:
        return _ok(text=m.clean(req.file_path, save=req.save, password=req.password))
    except Exception as e:
        return _err(e)


class AnalyzeReq(BaseModel):
    file_path: str
    analysis: str = "describe"
    columns: str | None = None
    group_column: str | None = None
    value_columns: str | None = None
    agg: str = "mean"
    x_columns: str | None = None
    y_column: str | None = None
    test: str = "ttest"
    date_column: str | None = None
    title: str | None = None
    ai_comment: bool = False
    save: bool = False
    format: str = "md"
    event_date: str | None = None
    treat_column: str | None = None
    period_column: str | None = None
    signal_column: str | None = None
    initial_capital: float = 100000.0
    fee_rate: float = 0.001
    password: str | None = None


@app.post("/api/analyze")
def analyze(req: AnalyzeReq):
    try:
        return _ok(text=m.analyze(
            req.file_path, analysis=req.analysis, columns=req.columns,
            group_column=req.group_column, value_columns=req.value_columns, agg=req.agg,
            x_columns=req.x_columns, y_column=req.y_column, test=req.test,
            date_column=req.date_column, title=req.title, ai_comment=req.ai_comment,
            save=req.save, format=req.format, event_date=req.event_date,
            treat_column=req.treat_column, period_column=req.period_column,
            signal_column=req.signal_column, initial_capital=req.initial_capital,
            fee_rate=req.fee_rate, password=req.password))
    except Exception as e:
        return _err(e)


@app.get("/api/chain")
def chain(action: str = "status", path: str | None = None, file_path: str | None = None,
          record_id: str | None = None, keep_versions: int = 10, max_age_days: int | None = None,
          archive: bool = True, check_live: bool = True, quick: bool = False):
    try:
        return _ok(text=m.chain(action=action, path=path, file_path=file_path, record_id=record_id,
                                keep_versions=keep_versions, max_age_days=max_age_days,
                                archive=archive, check_live=check_live, quick=quick))
    except Exception as e:
        return _err(e)


class AskReq(BaseModel):
    query: str
    # 多轮对话历史：[{role: 'user'|'assistant', content: str}, ...]
    history: list | None = None


class ApiKeyReq(BaseModel):
    api_key: str
class ModelReq(BaseModel):
    model: str


@app.post("/api/settings/api-key")
def set_api_key(req: ApiKeyReq):
    """保存 DeepSeek API Key（BYOK：每个使用者配置自己的 Key，keyring 优先）。"""
    ok, msg = m.save_api_key(req.api_key)
    if not ok:
        return _err(msg)
    return _ok({"configured": True}, text=msg)


@app.get("/api/settings/api-key/status")
def api_key_status():
    """查询 API Key 配置状态（不返回 Key 本身）。"""
    return _ok(m.api_key_status())


@app.delete("/api/settings/api-key")
def delete_api_key():
    """清除已保存的 API Key。"""
    _ok_text, msg = m.clear_api_key()
    return _ok({"configured": False}, text=msg)


@app.get("/api/settings/model")
def model_status():
    """Query current model name and its source."""
    return _ok(m.model_status())


@app.post("/api/settings/model")
def set_model(req: ModelReq):
    """Save DeepSeek model name (writes config.json, takes effect immediately)."""
    ok, msg = m.save_model(req.model)
    if not ok:
        return _err(msg)
    return _ok({"model": req.model}, text=msg)


@app.post("/api/ask")
def ask(req: AskReq):
    try:
        before = set(getattr(m, "_last_charts", []))
        text = m.ask(req.query, history=req.history)
        new = [f for f in getattr(m, "_last_charts", []) if f not in before]
        if new:
            text = f"{text}\n\n📊 图表文件: charts/{', charts/'.join(new)}"
        return _ok(text=text)
    except Exception as e:
        return _err(e)


def _chunk_text(text: str, size: int = 14):
    """按字符切块（模拟流式输出）"""
    for i in range(0, len(text), size):
        yield text[i:i + size]


@app.post("/api/ask/stream")
def ask_stream(req: AskReq):
    """SSE 流式对话：立即返回流，后台执行 ask；执行期间推送状态帧，完成后再按块推送结果。
    避免 DeepSeek 慢/挂起时前端长期停留在"思考中"。"""
    import json
    import queue
    import threading

    q: queue.Queue = queue.Queue()

    def worker():
        try:
            before = set(getattr(m, "_last_charts", []))
            result = m.ask(req.query, history=req.history)
            new = [f for f in getattr(m, "_last_charts", []) if f not in before]
            if new:
                result = f"{result}\n\n📊 图表文件: charts/{', charts/'.join(new)}"
        except Exception as e:
            q.put(("done", f"❌ {e}"))
            return
        q.put(("result", result or ""))

    def gen():
        t = threading.Thread(target=worker, daemon=True)
        t.start()
        # 状态帧：让前端立即知道任务在跑（前端忽略无 delta 的状态帧）
        yield f"data: {json.dumps({'delta': '', 'status': 'thinking'}, ensure_ascii=False)}\n\n"
        kind, payload = q.get()
        if kind == "done":
            yield f"data: {json.dumps({'delta': payload, 'done': True}, ensure_ascii=False)}\n\n"
            return
        for chunk in _chunk_text(payload):
            yield f"data: {json.dumps({'delta': chunk}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'delta': '', 'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class KbReq(BaseModel):
    action: str = "status"
    file_path: str | None = None


class KbQueryReq(BaseModel):
    query_text: str
    top_k: int = 5
    hybrid: bool = True


@app.post("/api/knowledge")
def knowledge(req: KbReq):
    try:
        if req.action == "add":
            return _ok(text=m.knowledge_add(req.file_path))
        if req.action == "remove":
            return _ok(text=m.knowledge_remove(req.file_path))
        if req.action == "clear":
            return _ok(text=m.knowledge_clear())
        return _ok(text=m.knowledge_status())
    except Exception as e:
        return _err(e)


@app.post("/api/knowledge/query")
def knowledge_query(req: KbQueryReq):
    try:
        return _ok(text=m.knowledge_query(req.query_text, req.top_k, hybrid=req.hybrid))
    except Exception as e:
        return _err(e)


@app.get("/api/charts")
def charts():
    """列出 charts/ 目录下已生成的图表文件（PNG/HTML）。"""
    try:
        chart_dir = Path(m.__file__).parent / "charts"
        if not chart_dir.is_dir():
            return _ok(data=[])
        items = []
        for p in sorted(chart_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True)[:50]:
            if p.suffix.lower() in (".png", ".html"):
                items.append({"name": p.name, "path": str(p), "kind": p.suffix.lower().lstrip("."),
                              "mtime": p.stat().st_mtime})
        return _ok(data=items)
    except Exception as e:
        return _err(e)


@app.get("/api/file")
def serve_chart_file(path: str):
    """返回 charts/ 目录内的图表文件（PNG/HTML），仅限该目录，防任意文件读取。"""
    chart_dir = CHART_DIR.resolve()
    target = Path(path).resolve() if Path(path).is_absolute() else (chart_dir / path).resolve()
    if chart_dir != target and chart_dir not in target.parents:
        raise HTTPException(403, "只允许访问 charts/ 目录")
    if not target.is_file():
        raise HTTPException(404, "文件不存在")
    return FileResponse(target)
