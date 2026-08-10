# -*- coding: utf-8 -*-
"""敏感数据加密工具（AES-256-GCM）。

密钥来源优先级：环境变量 FIN_ENC_KEY > Windows 凭据管理器（keyring）> 自动生成并保存。
"""

import base64
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEYRING_SERVICE = "finterminal"
KEYRING_USER = "fin_enc_key"


def _get_key():
    """获取 32 字节 AES 密钥。"""
    env_key = os.environ.get("FIN_ENC_KEY")
    if env_key:
        return env_key.encode("utf-8")[:32].ljust(32, b"\0")
    try:
        import keyring
        stored = keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
        if stored:
            # 兼容两种存储形态：base64(32字节) 或 原始字符串
            try:
                decoded = base64.b64decode(stored)
                if len(decoded) >= 32:
                    return decoded[:32]
            except Exception:
                pass
            return stored.encode("utf-8")[:32].ljust(32, b"\0")
        new_key = os.urandom(32)
        keyring.set_password(KEYRING_SERVICE, KEYRING_USER, base64.b64encode(new_key).decode())
        return new_key
    except Exception:
        # 兜底：本地密钥文件（尽量少用）
        key_file = Path.home() / ".finterminal_enc_key"
        if key_file.exists():
            return key_file.read_bytes()[:32].ljust(32, b"\0")
        new_key = os.urandom(32)
        try:
            key_file.write_bytes(new_key)
            return new_key
        except Exception as e:
            raise RuntimeError(
                "无法获取加密密钥：keyring 与本地密钥文件均不可用。"
                "请设置环境变量 FIN_ENC_KEY（任意字符串，至少 8 字符）"
            ) from e


def encrypt_bytes(data: bytes) -> bytes:
    """加密，返回 b"enc:v1:" + base64(nonce + ciphertext + tag)。"""
    key = _get_key()
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, data, None)
    return b"enc:v1:" + base64.b64encode(nonce + ct)


def decrypt_bytes(data: bytes) -> bytes:
    """解密 enc:v1 格式数据；非本格式原样返回。"""
    if not data.startswith(b"enc:v1:"):
        return data
    raw = base64.b64decode(data[len(b"enc:v1:"):])
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(_get_key()).decrypt(nonce, ct, None)
