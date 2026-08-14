# FinTerminal 桌面应用

基于 Electron + React 18 + TypeScript + ECharts 6 + shadcn/ui 的本地金融数据终端桌面版。

## 目录结构

```
finterminal-desktop/
├── electron/
│   ├── main.js          # Electron 主进程（启动/管理 Python 后端子进程）
│   └── preload.js       # 预加载脚本（向渲染进程暴露后端端口）
├── python/              # Python 后端（mcp_server/api_server 等，与主项目同步）
├── src/                 # React 前端（TypeScript）
│   ├── components/      # 对话流/看板/工作区/图表组件
│   └── components/ui/   # shadcn/ui 组件
├── scripts/
│   └── build_backend.py # pyinstaller 打包后端 exe
├── build/               # 应用图标 + 后端打包产物
└── electron-builder.yml # 打包配置（nsis 安装版 + portable 单文件）
```

## 开发运行

```bash
# 1. 安装依赖
npm install

# 2. 构建前端（生产模式加载 dist）
npm run build

# 3. 启动 Electron（自动拉起 Python 后端，端口 8000 起动态分配）
npm run electron:dev
```

`electron:dev` 会同时启动 Vite dev server 并打开 Electron（加载 http://localhost:5173）。

## 打包发布

```bash
# 1. 打包 Python 后端为单文件 exe（产物 build/backend/finterminal-backend.exe）
npm run backend:build

# 2. 打包桌面应用（产出 release/ 目录：Setup 安装版 + Portable 单文件版）
npm run electron:build
```

双击 `FinTerminal-<版本>.exe`（portable）或安装 Setup 版即可运行，**无需安装 Python 或任何依赖**。

## 架构说明

- **启动流程**：Electron 主进程 → 启动 Python 后端子进程（`api_server.py`，优先已打包的 `finterminal-backend.exe`）→ 等待 `/api/health` 就绪 → 加载前端 → 前端通过 `http://127.0.0.1:<port>/api` 调用后端。
- **数据持久化**：打包模式下所有数据（数据链/知识库/缓存/图表/会话）写入 exe 同级的 `data/` 目录（`FIN_DATA_DIR`），不会写进一次性解压目录。
- **进程管理**：用户退出应用时主进程自动 `taskkill /T` 终止后端子进程树（含 pyinstaller 派生的子进程）。
- **端口冲突**：8000 被占用时自动探测 8001-8020 的空闲端口，并通过 preload 把实际端口传给前端。
- **安全**：`/api/file` 仅允许访问 `charts/` 目录（防任意文件读取）；渲染进程禁用 nodeIntegration，仅通过 preload 暴露白名单 API。

## 界面

- 左侧：鼠标悬停滑出导航（对话/文件/图表/数据链/知识库/设置/导出）
- 中央：ChatGPT 风格流式对话（SSE），图表内联渲染，来源标注
- 右侧：实时行情 + 数据链状态 + 知识库状态看板（抽屉式，可固定）
- 底部：可收起的工作区面板（图表详情 / 研报分析 / 数据链可视化 / 统计分析）
- 多语言：设置页支持中文 / English 一键切换，选择持久化保存
