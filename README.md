# FinTerminal —— 金融数据终端 MCP 服务

一个基于 FastMCP 的本地 MCP（Model Context Protocol）服务器，核心思路：
**读取本地数据文件 → 可视化 → 自然语言对话操作 → 数据链追溯文件变更**。

已注册给 Cline 使用，服务名 `fin-terminal`，对外暴露 **8 个精简能力工具**。

> 设计说明：内部功能粒度较细（29 个底层能力），但 MCP 只对外暴露 8 个统一入口，
> 降低模型工具选择负担与 schema 上下文占用（工具 >20 个时模型选择准确率跌破 90%）。

## 功能总览

| 模块 | 说明 |
|---|---|
| 文件读取 | CSV / Excel / Word / PDF / 文本，自动识别编码与分隔符；扫描件 OCR、加密文件密码解密、损坏检测 |
| 数据可视化 | 24+ 种图表类型，同时输出静态 PNG 与**交互式 HTML**（plotly 内嵌 JS，离线可交互），输出到 `charts/` |
| 自然语言交互 | 搜索文件、多轮对话选文件并画图，其余意图走 DeepSeek 函数调用 |
| 数据链 | 文件变更历史 + SHA-256 哈希链（区块链基础）+ 快照清理 + 完整性校验 |
| 数据清洗 | `clean` 自动处理脏数据：空行/空列、重复行、空白、重复列名 |
| 统计分析 | 描述/相关/分组/回归（含**稳健标准误**）/t检验/ANOVA/**非参数检验**/趋势/**VIF**/**事件研究**/**DID** |
| 自动报告 | `analyze(analysis="report")` 生成论文风格报告，**支持 md/docx/pdf 导出**，可选 AI 结论建议 |
| 实时数据源 | 实时行情 + 多周期K线（日/周/月）+ 技术指标（MA/MACD/RSI/布林/KDJ/OBV/ATR）+ **时序预测（ARIMA/ETS/线性，AIC 自动择优）**；本地缓存（行情 30s / K线 1h）+ 多源交叉验证；腾讯 → AkShare → yfinance → **插件** 多级回退 |
| 多模态视觉 | `read(图片路径)` 自动 OCR 图片文字并还原表格数据 |
| RAG 知识库 | 本地向量检索 + **BM25 混合检索（RRF 融合）** + **引用溯源**；语义分块、重复添加自动更新、可移除/清空/列清单 |
| Agentic 研究 | `ask` 说"写一份贵州茅台的研究报告"→ 自动完成行情/指标/趋势/预测/研报/AI结论的完整研究报告；**逐章节降级**：行情/K线/预测失败时跳过并标注，离线也能基于知识库出报告 |
| 数据可信 | 数据链链头支持 **RFC3161 可信时间戳锚定**（chain action=anchor），可第三方验证"此时刻前已存在且未被篡改" |
| 多模态 VLM | 配置 `vision_api_key/vision_model` 后，图片走视觉大模型理解图表数据；未配置自动回退 OCR |
| 本地小模型 | 配置 `local_model`（如 Qwen2.5-0.5B）后，融合分析可走本地推理；未配置自动回退 DeepSeek |
| 策略回测 | `analyze(analysis="backtest")`：信号列回测，输出收益率/回撤/夏普/胜率/交易次数 |
| 插件系统 | `plugins/` 目录自动加载插件：可扩展数据源（quote/kline）、分析类型、图表类型，不影响 8 工具架构 |

## 工具清单（8 个）

| 工具 | 说明 |
|---|---|
| `read(file_path=None, source="local", ..., kline=False, days=60, period="daily", cross_check=False, forecast=False, horizon=10, model="auto")` | 读取数据：`source="api"` 查行情/K线/交叉验证；`forecast=True` 时序预测（model: linear/arima/ets/auto） |
| `detect(path)` | 文件体检：格式匹配、加密、损坏、空文件检测 |
| `clean(file_path, save=False, password=None)` | 清洗杂乱数据：空行/空列、去重、修剪空白、列名规范化 |
| `plot(chart_type, file_path, ..., source="local", days=60)` | 画图，支持 27 种内置类型 + 插件扩展；`source="api"` 时直接画股票K线/走势/技术面 |
| `analyze(file_path, analysis, ...)` | 统计分析统一入口：describe / correlation / groupby / regression / test / trend / report |
| `search(keyword=None, directory=None, recursive=False)` | 搜索文件；keyword 留空列出数据文件 |
| `chain(action, ...)` | 数据链统一入口：status / track / untrack / snapshot / history / show / cleanup / verify |
| `ask(query)` | 多轮对话入口，DeepSeek 驱动，自动调用以上工具 |

**意图路由与消歧**：`ask` 内置时间意图识别（实时 vs 历史）与数据源路由——"现在/当前/多少钱"走实时行情，"历史/财报/研报"走 RAG 知识库；时间意图不明确时返回候选确认（回复 1/2 选择）；行情与知识库结果都标注 📌 数据来源，并支持"切换到实时数据 / 切换到历史研报"随时纠正路由。模糊指令（如"帮我看看这个"）会基于当前上下文返回可用操作列表。

### 支持的图表类型（plot 的 chart_type）

**支持的图表类型（chart_type）**：

`line` 折线 · `bar` 柱状 · `barh` 水平柱状 · `stacked_bar` 堆叠柱状 · `grouped_bar` 分组柱状 ·
`scatter` 散点 · `bubble` 气泡 · `pie` 饼图 · `donut` 环形 · `area` 面积 · `candlestick` K线 ·
`box` 箱线 · `violin` 小提琴 · `histogram` 直方 · `heatmap` 热力（相关性/透视） · `radar` 雷达 ·
`waterfall` 瀑布 · `funnel` 漏斗 · `step` 步进 · `polar` 极坐标 · `errorbar` 误差条 ·
`treemap` 矩形树 · `scatter3d` 3D散点 · `surface` 3D曲面

另加：`technical` 技术面组合图（价格 + MA + 布林带 + RSI，需 `source="api"` 自动计算指标）。
另加：`wordcloud` 中文词云（jieba 分词）、`sankey` 桑基图（源/目标/流量三列）。

图表保存到 `charts/` 目录，文件名带时间戳，不会覆盖旧图。K线图遵循中国习惯：红涨绿跌。

### analyze 的分析类型（analysis 参数）

| 类型 | 说明 |
|---|---|
| `describe` | 描述性统计：均值、标准差、分位数、偏度、峰度、缺失值 |
| `correlation` | Pearson 相关矩阵 + 显著性 p 值（星标）与显著相关对 |
| `groupby` | 分组统计：mean/sum/count/std/median/min/max |
| `regression` | OLS 线性回归：系数、标准误、t 值、p 值、R²、F 检验 |
| `test` | 显著性检验：`ttest`（两组）/ `anova`（多组） |
| `trend` | 时间趋势：总增幅、CAGR、平均环比、线性趋势 |
| `vif` | 多重共线性诊断（方差膨胀因子） |
| `event` | 事件研究：事件窗口异常收益 AR / 累计异常收益 CAR |
| `did` | 双重差分：treat×post 交互项估计 |
| `backtest` | 策略回测：信号列 → 收益率/回撤/夏普/胜率（`signal_column`、`initial_capital`、`fee_rate`） |
| `report` | 自动生成论文风格报告（`format` 可选 md/docx/pdf；`ai_comment=True` 由 DeepSeek 撰写结论建议），输出到 `reports/` |

`ask` 支持的说法示例：`用第1个`、`查看第1个`、`画贵州茅台的技术面图`、`做相关分析`、`生成研究论文报告`、`查一下贵州茅台行情`、`把这份研报添加到知识库`（重复添加自动更新）、`查一下知识库：茅台的估值`、`列出知识库文档`、`清空知识库`、`写一份贵州茅台的研究报告`（Agentic 自主研究）、`给数据链盖时间戳`（chain anchor）、`结合历史研报和当前行情，分析贵州茅台`、`重新选择`。所有读取/画图操作都会自动把文件记入数据链。

## 数据链说明

### 工作原理

- 文件第一次被读取 → 生成「初始快照」记录（区块）
- 之后每次内容变化 → 追加新记录，包含：时间、操作（创建/修改/删除）、前后哈希、大小、**具体改动**（新增/删除的行及内容、修改的单元格前后值）
- 每条记录的 `prev_hash` 指向上一条的 `record_hash`，形成不可篡改的哈希链
- 每次变化保存一份文件快照，供差异对比和日后恢复

### 存储结构

```
data_chain/
├── ledger.json     # 账本（区块记录 + 链头哈希）
├── tracked.json    # 跟踪清单
├── cleanup.json    # 清理登记（已归档 / 已删除的快照）
├── snapshots/      # 在库快照
└── archive/        # 归档快照
```

### 快照清理与校验

- 清理只动快照文件，**账本区块保持不可变**；清理动作登记到 `cleanup.json`
- `chain_verify` 检查四层：链内哈希衔接、在库快照哈希、归档快照哈希（已清理的跳过）、当前文件与最后记录的对照（发现未记录的变更）
- 清理时每文件至少保留最近 1 版快照，保证后续差异对比可用

### 使用示例

```
跟踪桌面上的销售数据.csv
检查一下这个文件有没有变化
查一下 销售数据.csv 的历史记录
查看记录 #3 具体改了什么
清理历史快照（每文件保留最近 5 版，归档）
校验数据链完整性
```

## 安装与运行

### 依赖

- Python 3.13+
- pip 安装：`fastmcp pandas pdfplumber openai matplotlib python-docx openpyxl xlrd pymupdf rapidocr-onnxruntime pypdf msoffcrypto-tool scipy squarify chromadb sentence-transformers yfinance reportlab akshare wordcloud jieba rank_bm25 statsmodels pytest pip-audit`

### 测试

- 单元测试：`python -m pytest tests/ -q`（48 项：分析/图表/行情/加密/数据链/导出/路由/回测/知识库/插件/预测）
- 依赖安全扫描：`python -m pip_audit`
- 静态质量检查：`python -m ruff check .`（规则配置见 `pyproject.toml`，中文全角标点/紧凑风格已豁免）

### 启动性能

- pandas / scipy / matplotlib / openai / pdfplumber 等重型依赖均为**惰性加载**（首次使用时才导入），
  服务启动约 **3.2 秒**（未优化前 7.9 秒，-60%）；首次绘图/统计调用会略慢属正常

> `.xls` 需要 `xlrd`，`.xlsx` 需要 `openpyxl`，Word 需要 `python-docx`，扫描件 OCR 需要 `pymupdf` + `rapidocr-onnxruntime`，加密 Office 文件解密需要 `msoffcrypto-tool`。

### Cline 注册

`cline_mcp_settings.json` 已配置好：

```json
{
  "mcpServers": {
    "fin-terminal": {
      "command": "C:\\Users\\liuj\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
      "args": ["C:\\Users\\liuj\\Desktop\\finterminal-mcp\\mcp_server.py"]
    }
  }
}
```

> 注意：代码改动后需在 Cline 中断开重连 `fin-terminal`（或重载窗口）才会加载新代码。

### 配置

- **API Key 保护**：密钥保存在 Windows 凭据管理器，`config.json` 不含明文。设置方式：`python set_api_key.py sk-你的密钥`；读取优先级：环境变量 `DEEPSEEK_API_KEY` > 凭据管理器 > `config.json`（迁移兜底）
- **可选加密**：`config.json` 中 `encrypt_knowledge=true` 加密知识库内容、`encrypt_snapshots=true` 加密数据链快照（AES-256-GCM，密钥存凭据管理器，可用环境变量 `FIN_ENC_KEY` 覆盖；`FIN_KB_ENCRYPT=1` / `FIN_SNAP_ENCRYPT=1` 可临时开启）
- `config.json`：模型名、桌面路径、加密开关、`market_names`（股票名称→代码映射）、`vision_api_key/vision_model/vision_base_url`（VLM 视觉模型，可选）；模板见 `config.example.json`
- `session.json`：会话状态持久化（搜索结果、选中文件、列名），自动维护

```json
{
  "deepseek_api_key": "sk-...",
  "deepseek_model": "deepseek-v4-flash",
  "desktop_dir": "C:/Users/liuj/Desktop"
}
```

## 目录结构

```
finterminal-mcp/
├── mcp_server.py          # MCP 服务器主逻辑（12 个业务工具）
├── data_chain.py          # 数据链模块（8 个 chain_* 工具）
├── analysis.py            # 统计分析模块（7 个 stat_*/generate_report 工具）
├── charts.py              # 图表模块（24 种图表）
├── market_data.py         # 实时行情数据源（腾讯/yfinance）
├── vision_ocr.py          # 多模态图片解析（OCR + 表格还原）
├── knowledge.py           # RAG 知识库（chromadb + 向量嵌入）
├── plugin_manager.py      # 插件加载器
├── plugins/               # 插件目录（example_plugin.py 为示例）
├── backtest.py            # 策略回测框架
├── local_llm.py           # 本地小模型推理（可选）
├── config.json            # API Key 配置
├── session.json           # 会话状态
├── cline_mcp_settings.json# Cline 注册配置
├── charts/                # 图表输出
├── reports/               # 自动报告输出
├── cleaned/               # 清洗结果输出（save=True 时）
├── knowledge/             # RAG 知识库持久化（首次添加文档时创建）
└── data_chain/            # 数据链数据（首次使用自动创建）
```

## 已知限制

- 实时行情基于腾讯公开接口（无需密钥）；海外标的回退 yfinance，需要可访问 Yahoo 的网络
- 图表已扩展到 25 种，但暂不支持词云、桑基图等特殊类型
- 趋势预测为线性模型 v1（研究参考用）；VLM 视觉模型需自行配置密钥
- 数据链为本地单机账本，RFC3161 时间戳提供"时刻存在性"证明，完整防篡改仍需多副本/多方同步

## 产品风险与注意事项

- **MCP 服务无鉴权且可读任意路径**：仅限本机信任环境使用，切勿暴露到共享机器或公网
- **第三方接口依赖**：行情（腾讯/yfinance）与时间戳（freetsa.org）均为公开服务，无 SLA，可能变更、限流或不可达；关键决策前请交叉验证数据
- **API Key 安全**：此前密钥曾在对话与文件中出现过，强烈建议前往 DeepSeek 平台轮换后执行 `python set_api_key.py sk-新密钥`
- **加密默认关闭**：`encrypt_knowledge` / `encrypt_snapshots` 需手动开启，开启前已有数据为明文
- **网络依赖**：实时行情/知识库融合/AI 结论/时间戳锚定均需联网；离线时行情与 AI 结论明确降级提示，研究报告会跳过不可用章节（数据章节仍可本地生成）
- **AI 结论仅供研究参考**：所有 AI 生成内容（研报结论、融合分析、图片解析、报告评论）统一附带"非投资建议、请人工复核"风险提示；模型可能错误解读数据，关键决策前必须人工复核
- **已知漏洞**：chromadb 1.5.9 存在 PYSEC-2026-311（暂无修复版本），仅用于本地向量检索，影响可控；pip 等其他漏洞已升级修复
