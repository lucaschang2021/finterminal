# -*- coding: utf-8 -*-
"""本地小模型推理（可选）。

启用方式：config.json 设置 local_model（如 "Qwen/Qwen2.5-0.5B-Instruct"），
或环境变量 FIN_LOCAL_MODEL。首次使用会从 HF（默认 hf-mirror）下载模型（体积较大）。
未配置或加载失败时，complete() 返回 None，调用方自动回退云端 DeepSeek。
"""

import os
from pathlib import Path

_model = None
_tokenizer = None


def _config():
    try:
        import json
        return json.load(open(Path(__file__).parent / "config.json", encoding="utf-8"))
    except Exception:
        return {}


def model_name():
    return os.environ.get("FIN_LOCAL_MODEL") or _config().get("local_model") or ""


def available():
    return bool(model_name())


def _load():
    global _model, _tokenizer
    if _model is None:
        os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
        from transformers import AutoModelForCausalLM, AutoTokenizer
        name = model_name()
        _tokenizer = AutoTokenizer.from_pretrained(name)
        _model = AutoModelForCausalLM.from_pretrained(name)
    return _model, _tokenizer


def complete(prompt, max_tokens=500):
    """本地生成文本；不可用时返回 None。"""
    if not available():
        return None
    try:
        model, tokenizer = _load()
        inputs = tokenizer(prompt, return_tensors="pt")
        out = model.generate(**inputs, max_new_tokens=max_tokens, do_sample=False)
        return tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    except Exception:
        return None
