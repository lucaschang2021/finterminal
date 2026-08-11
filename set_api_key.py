"""把 DeepSeek API Key 存入 Windows 凭据管理器（keyring）。

用法：
    python set_api_key.py sk-你的密钥
"""

import sys

import keyring

KEYRING_SERVICE = "finterminal"
KEYRING_USER = "deepseek_api_key"


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("用法: python set_api_key.py sk-你的密钥")
        return
    key = sys.argv[1].strip()
    keyring.set_password(KEYRING_SERVICE, KEYRING_USER, key)
    print("✅ API Key 已存入 Windows 凭据管理器（服务: finterminal）")
    print("配置读取优先级: 环境变量 DEEPSEEK_API_KEY > 凭据管理器 > config.json")


if __name__ == "__main__":
    main()
