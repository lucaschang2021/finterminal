"""FinTerminal HTTP API 桥（供 React 前端调用）。

复用 mcp_server 的 8 个工具内部函数，暴露为 REST 接口：
    python -m uvicorn api_server:app --host 127.0.0.1 --port 8000
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import mcp_server as m

# charts/ 目录（静态图表文件，serve_chart_file 只允许访问该目录）
CHART_DIR = Path(m.__file__).resolve().parent / "charts"

app = FastAPI(title="FinTerminal API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    # 仅绑定 127.0.0.1 的本地回环服务，无 Cookie 会话凭证；
    # 允许任意 Origin 以兼容 Electron 生产模式（file:// 下 Origin 为 null/file://）
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class ApiKeyReq(BaseModel):
    api_key: str


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


@app.post("/api/ask")
def ask(req: AskReq):
    try:
        return _ok(text=m.ask(req.query))
    except Exception as e:
        return _err(e)


def _chunk_text(text: str, size: int = 14):
    """按字符切块（模拟流式输出）"""
    for i in range(0, len(text), size):
        yield text[i:i + size]


@app.post("/api/ask/stream")
def ask_stream(req: AskReq):
    """SSE 流式对话：先执行完整 ask，再按块推送（打字机效果）。"""
    import json

    def gen():
        try:
            result = m.ask(req.query)
        except Exception as e:
            yield f"data: {json.dumps({'delta': f'❌ {e}', 'done': True}, ensure_ascii=False)}\n\n"
            return
        for chunk in _chunk_text(result or ''):
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
