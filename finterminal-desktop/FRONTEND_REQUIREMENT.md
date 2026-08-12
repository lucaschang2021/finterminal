# 前端需求：设置页新增 DeepSeek API Key 配置（BYOK）

> 后端已实现并验证（73 项测试全绿）。前端只需按此接入。

## 背景

FinTerminal 将分发给其他用户使用，每个使用者需要配置**自己的** DeepSeek API Key（BYOK）。
后端已提供 3 个接口，前端在"设置"页接入即可。

## 接口

均在现有 `/api` 前缀下（开发模式走 Vite 代理，生产模式用 `window.finterminal.apiBase`）。

### 1. 保存 Key

```
POST /api/settings/api-key
Body: { "api_key": "sk-xxxx" }
```

成功：
```json
{ "ok": true, "text": "API Key 已保存（存储位置: Windows 凭据管理器）" }
```

失败（Key 为空等）：
```json
{ "ok": false, "error": "API Key 不能为空" }
```

### 2. 查询状态（不返回 Key 本身）

```
GET /api/settings/api-key/status
```

返回：
```json
{
  "ok": true,
  "data": {
    "configured": true,
    "source": "环境变量 | Windows 凭据管理器 | config.json | 未配置",
    "model": "deepseek-v4-flash"
  }
}
```

### 3. 清除 Key

```
DELETE /api/settings/api-key
```

返回：
```json
{ "ok": true, "text": "API Key 已清除" }
```

## UI 要求

位置：**设置页 → "模型配置"卡片**，在现有"模型名"输入框上方新增"API Key"区域。

### 元素

1. **API Key 输入框**
   - `type="password"`，可选"显示/隐藏"切换
   - placeholder：`sk-请输入你的 DeepSeek API Key`

2. **保存按钮**
   - 调 `POST /api/settings/api-key`
   - 成功：toast/提示"已保存"；失败：显示后端返回的 `error`
   - 保存成功后**清空输入框**（Key 不回显，防泄露）

3. **清除按钮**
   - 调 `DELETE /api/settings/api-key`
   - 点击前 `confirm` 确认："确定清除已保存的 API Key？"

4. **状态徽标**（页面加载时调 `GET /api/settings/api-key/status`）
   - 已配置 → 绿色徽标：`已配置（来源: XXX）`
   - 未配置 → 灰色徽标：`未配置`，输入框旁提示"配置后可使用 AI 对话 / 研报功能"

### 提示文案（输入框下方，小字灰色）

- Key 优先存储于 Windows 凭据管理器，仅保存在本机
- 若已设置环境变量 `DEEPSEEK_API_KEY`，将以环境变量为准（优先级最高）
- 未配置 Key 时，本地功能（文件 / 图表 / 分析 / 数据链 / 知识库）不受影响

### 交互细节

- 保存 / 清除过程中按钮显示 loading
- 保存接口运行时即时生效，**无需重启应用**
- 状态徽标在保存 / 清除成功后即时刷新

## 验收标准

1. 未配置时显示"未配置"灰徽标，AI 对话返回"未配置 DeepSeek API Key"引导
2. 输入 Key 保存 → 徽标变绿"已配置（来源: Windows 凭据管理器）"→ AI 对话可用
3. 清除 → 徽标恢复"未配置"
4. Key 输入框保存后清空，页面任何地方不回显 Key
