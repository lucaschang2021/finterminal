"""
RAG 知识库模块（FinTerminal）
==============================
基于 chromadb + sentence-transformers 的本地向量知识库：
- add_document(file)：抽取文本 → 分块 → 向量化存储
- query(text)：检索最相关片段
- status()：片段数量统计

嵌入模型优先用 sentence-transformers（all-MiniLM-L6-v2），
未安装时回退到 chromadb 内置 ONNX MiniLM。
首次使用会下载模型（已默认指向 hf-mirror 国内镜像）。
"""

import datetime
import os
import re
from pathlib import Path

# 国内镜像：模型下载走 hf-mirror，避免网络问题
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

def _kb_root():
    """数据根目录：打包模式支持 FIN_DATA_DIR（onefile 下 __file__ 指向一次性目录）。"""
    env = os.environ.get("FIN_DATA_DIR")
    return Path(env) if env else Path(__file__).parent


KNOWLEDGE_DIR = _kb_root() / "knowledge"

_client = None
_collection = None
_embedder = None
_bm25 = None


def _encrypt_enabled():
    """知识库内容加密开关：环境变量 FIN_KB_ENCRYPT=1 或 config.json 的 encrypt_knowledge=true。"""
    if os.environ.get("FIN_KB_ENCRYPT", "").lower() in ("1", "true", "yes"):
        return True
    try:
        import json
        with open(Path(__file__).parent / "config.json", encoding="utf-8") as f:
            cfg = json.load(f)
        return bool(cfg.get("encrypt_knowledge", False))
    except Exception:
        return False


def _get_embedder():
    global _embedder
    if _embedder is None:
        # 仅当模型已本地缓存时才用 sentence-transformers，
        # 避免离线/首次使用时联网重试拖慢回退到 chroma ONNX
        hub_dir = os.path.join(Path.home(), ".cache", "huggingface", "hub",
                               "models--sentence-transformers--all-MiniLM-L6-v2")
        if os.path.isdir(hub_dir):
            try:
                from sentence_transformers import SentenceTransformer
                _embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            except Exception:
                _embedder = False
        else:
            _embedder = False
    return _embedder or None


def _get_collection():
    global _client, _collection
    if _collection is None:
        import chromadb
        _client = chromadb.PersistentClient(path=str(KNOWLEDGE_DIR))
        _collection = _client.get_or_create_collection(name="finterminal")
    return _collection


def _embed(texts):
    emb = _get_embedder()
    if emb is not None:
        return emb.encode(texts).tolist()
    from chromadb.utils import embedding_functions
    ef = embedding_functions.ONNXMiniLM_L6_V2()
    return [ef([t])[0] for t in texts]


def _tokenize(text):
    """中文用 jieba 分词，英文/符号按空白拆分。"""
    try:
        import jieba
        return list(jieba.cut(text))
    except Exception:
        return list(text.lower())


def _get_bm25():
    """构建 BM25 索引（文档为明文，自动解密加密片段）。"""
    global _bm25
    if _bm25 is None:
        try:
            from rank_bm25 import BM25Okapi
        except ImportError:
            _bm25 = False
            return None
        col = _get_collection()
        data = col.get(include=["documents"])
        ids, docs = (data.get("ids") or []), []
        for d in data.get("documents") or []:
            plain = d
            if isinstance(d, str) and d.startswith("enc:v1:"):
                try:
                    import crypto_utils
                    plain = crypto_utils.decrypt_bytes(d.encode("ascii")).decode("utf-8")
                except Exception:
                    plain = ""
            docs.append(plain or "")
        _bm25 = {"model": BM25Okapi([_tokenize(x) for x in docs]), "ids": ids}
    return _bm25


def _extract_text(path):
    """从常见文件类型抽取文本（不依赖 mcp_server，避免循环导入）。"""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        try:
            import pymupdf as fitz
            doc = fitz.open(path)
            return "\n".join(p.get_text() for p in doc)
        except Exception:
            return ""
    if ext == ".docx":
        try:
            import docx
            d = docx.Document(path)
            return "\n".join(p.text for p in d.paragraphs)
        except Exception:
            return ""
    if ext in (".csv", ".txt", ".md", ".json", ".py", ".log", ".yaml", ".yml", ".toml", ".xml"):
        for enc in ("utf-8", "utf-8-sig", "gbk", "gb2312", "latin-1"):
            try:
                with open(path, encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        return ""
    if ext == ".xlsx":
        try:
            import excel_utils
            return excel_utils.read_xlsx(path).to_string(index=False)
        except Exception:
            return ""
    if ext == ".xls":
        try:
            import pandas as pd
            return pd.read_excel(path).to_string(index=False)
        except Exception:
            return ""
    return ""


def _split_units(text):
    """把文本切成语义单元：优先段落（空行分隔），其次句子（中文/英文标点）。"""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(paragraphs) > 1:
        return paragraphs
    sentences = [s.strip() for s in re.split(r"(?<=[。！？；!?;\n])", paragraphs[0]) if s.strip()]
    return sentences if len(sentences) > 1 else [paragraphs[0]]


def _chunk(text, size=500, overlap=80):
    """语义分块：以段落/句子为边界聚合，避免在句子中间硬切；超长单元内部二次切分。"""
    text = text.strip()
    if not text:
        return []
    units = _split_units(text)
    chunks = []
    buf = ""
    for u in units:
        if len(u) > size:
            if buf:
                chunks.append(buf)
                buf = ""
            for piece in _split_units(u):
                if len(buf) + len(piece) > size and buf:
                    chunks.append(buf)
                    buf = buf[-overlap:] if overlap else ""
                buf += piece
            continue
        if len(buf) + len(u) > size and buf:
            chunks.append(buf)
            buf = buf[-overlap:] if overlap else ""
        buf += ("" if not buf else "\n") + u
    if buf.strip():
        chunks.append(buf)
    return [c.strip() for c in chunks if c.strip()]


def add_document(file_path):
    """把文件内容向量化加入知识库（同源文件重复添加=更新替换），返回切片数量。"""
    text = _extract_text(file_path)
    if not text.strip():
        raise ValueError("未能从文件中提取文本内容（不支持的类型或文件为空）")
    chunks = _chunk(text)
    if not chunks:
        raise ValueError("文件内容为空")
    col = _get_collection()
    source = str(Path(file_path).resolve())
    # 同源旧片段先删除，实现"重新添加即更新"
    old = col.get(where={"source": source}, include=[])
    if old and old.get("ids"):
        col.delete(ids=old["ids"])
    stamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
    ids = [f"{Path(file_path).stem}-{i}-{stamp}" for i in range(len(chunks))]
    metas = [{"source": source, "chunk": i, "added": stamp} for i in range(len(chunks))]
    docs = chunks
    if _encrypt_enabled():
        import crypto_utils
        docs = [crypto_utils.encrypt_bytes(c.encode("utf-8")).decode("ascii") for c in chunks]
    col.add(ids=ids, documents=docs, embeddings=_embed(chunks), metadatas=metas)
    global _bm25
    _bm25 = None  # 索引失效，重建
    return len(chunks)


def query(query_text, top_k=5, hybrid=True):
    """检索最相关的知识库片段；hybrid=True 时使用 向量+BM25 混合检索。
    返回 [{来源, 距离, 内容, 综合分?}]。"""
    col = _get_collection()
    total = col.count()
    if total == 0:
        return []
    k = max(1, min(top_k * 3 if hybrid else top_k, total))
    res = col.query(query_embeddings=_embed([query_text]), n_results=k,
                    include=["documents", "metadatas", "distances"])
    ids = res.get("ids", [[]])[0]
    out = []
    for i, doc in enumerate(res["documents"][0]):
        meta = res["metadatas"][0][i] or {}
        if isinstance(doc, str) and doc.startswith("enc:v1:"):
            try:
                import crypto_utils
                doc = crypto_utils.decrypt_bytes(doc.encode("ascii")).decode("utf-8")
            except Exception:
                doc = "[加密内容无法解密]"
        rid = ids[i] if i < len(ids) else ""
        out.append({
            "id": rid,
            "来源": meta.get("source", "未知"),
            "距离": round(float(res["distances"][0][i]), 4),
            "内容": doc,
        })
    if not hybrid:
        return out[:top_k]

    bm = _get_bm25()
    if not bm:
        return out[:top_k]
    scores = bm["model"].get_scores(_tokenize(query_text))
    max_s = float(scores.max()) if scores.size else 0.0
    id_score = {}
    for j, rid in enumerate(bm["ids"]):
        id_score[rid] = float(scores[j]) / max_s if max_s else 0.0
    for item in out:
        sim = 1 / (1 + item["距离"])
        item["综合分"] = round(0.6 * sim + 0.4 * id_score.get(item["id"], 0.0), 4)
    out.sort(key=lambda x: -x["综合分"])
    return out[:top_k]


def status():
    """知识库状态。"""
    try:
        col = _get_collection()
        data = col.get(include=["metadatas"])
        ids = data.get("ids", []) or []
        sources = {(m or {}).get("source", "未知") for m in (data.get("metadatas", []) or [])}
        return {"片段数": len(ids), "来源数": len(sources)}
    except Exception as e:
        return {"片段数": 0, "来源数": 0, "错误": str(e)}


def remove_document(file_path):
    """按来源路径删除某个文档的所有片段。返回删除数量。"""
    col = _get_collection()
    source = str(Path(file_path).resolve())
    old = col.get(where={"source": source}, include=[])
    ids = old.get("ids", []) or []
    if ids:
        col.delete(ids=ids)
    global _bm25
    _bm25 = None
    return len(ids)


def clear():
    """清空整个知识库。返回删除片段数。"""
    col = _get_collection()
    data = col.get(include=[])
    ids = data.get("ids", []) or []
    if ids:
        col.delete(ids=ids)
    global _bm25
    _bm25 = None
    return len(ids)


def list_sources():
    """列出知识库中的所有文档来源及片段数。"""
    col = _get_collection()
    data = col.get(include=["metadatas"])
    counts = {}
    for m in data.get("metadatas", []) or []:
        s = (m or {}).get("source", "未知")
        counts[s] = counts.get(s, 0) + 1
    return counts
