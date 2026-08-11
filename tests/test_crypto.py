# -*- coding: utf-8 -*-
"""加密工具测试。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["FIN_ENC_KEY"] = "pytest-key-0123456789abcdef"
import crypto_utils as cu


def test_roundtrip():
    data = "机密内容-123".encode("utf-8")
    enc = cu.encrypt_bytes(data)
    assert enc.startswith(b"enc:v1:")
    assert data not in enc
    assert cu.decrypt_bytes(enc) == data


def test_plain_passthrough():
    assert cu.decrypt_bytes(b"plain-text") == b"plain-text"


def test_different_data_different_cipher():
    assert cu.encrypt_bytes(b"a") != cu.encrypt_bytes(b"a")
