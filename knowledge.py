# -*- coding: utf-8 -*-
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
from pathlib import Path

# 国内镜像：模型下载走 hf-mirror，避免网络问题
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"

_client = None
_collection = None
_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except Exception:
            _embedder = False  # 标记不可用，回退 chroma 内置
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
                with open(path, "r", encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        return ""
    if ext in (".xlsx", ".xls"):
        try:
            import pandas as pd
            return pd.read_excel(path).to_string(index=False)
        except Exception:
            return ""
    return ""


def _chunk(text, size=500, overlap=80):
    """按字符切块，块间有重叠以保证语义连贯。"""
    text = text.strip()
    if not text:
        return []
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        chunks.append(text[start:start + size])
        start += size - overlap
    return chunks


def add_document(file_path):
    """把文件内容向量化加入知识库，返回切片数量。"""
    text = _extract_text(file_path)
    if not text.strip():
        raise ValueError("未能从文件中提取文本内容（不支持的类型或文件为空）")
    chunks = _chunk(text)
    if not chunks:
        raise ValueError("文件内容为空")
    col = _get_collection()
    stamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
    ids = [f"{Path(file_path).stem}-{i}-{stamp}" for i in range(len(chunks))]
    metas = [{"source": str(file_path), "chunk": i, "added": stamp} for i in range(len(chunks))]
    col.add(ids=ids, documents=chunks, embeddings=_embed(chunks), metadatas=metas)
    return len(chunks)


def query(query_text, top_k=5):
    """检索最相关的知识库片段，返回 [{来源, 距离, 内容}]。"""
    col = _get_collection()
    total = col.count()
    if total == 0:
        return []
    k = max(1, min(top_k, total))
    res = col.query(query_embeddings=_embed([query_text]), n_results=k,
                    include=["documents", "metadatas", "distances"])
    out = []
    for i, doc in enumerate(res["documents"][0]):
        meta = res["metadatas"][0][i] or {}
        out.append({
            "来源": meta.get("source", "未知"),
            "距离": round(float(res["distances"][0][i]), 4),
            "内容": doc,
        })
    return out


def status():
    """知识库状态。"""
    try:
        col = _get_collection()
        return {"片段数": col.count()}
    except Exception as e:
        return {"片段数": 0, "错误": str(e)}
