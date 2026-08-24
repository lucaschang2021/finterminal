# FinTerminal

**Local-first AI financial research infrastructure built around MCP, quantitative analysis, RAG, agentic research, and auditable data provenance.**

[简体中文](README.zh-CN.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

> **Status:** FinTerminal is an early-stage open-source project. Interfaces, packaging, and research workflows may evolve quickly. Feedback, bug reports, integrations, and contributions are welcome.

## Why FinTerminal?

Financial research often lives across spreadsheets, PDFs, market-data websites, notebooks, charting tools, and AI chat windows. FinTerminal brings those workflows into one local-first research layer that AI clients can access through the Model Context Protocol (MCP).

The project intentionally exposes a compact set of high-level MCP tools while keeping richer capabilities behind them. The goal is to reduce tool-selection overhead for agents without giving up serious financial-analysis functionality.

FinTerminal can be used as:

- an **MCP server** for AI-assisted financial research;
- a **Windows desktop research terminal** with a local Python backend;
- a **quantitative analysis toolkit** for common research workflows;
- a **local RAG knowledge base** with source attribution;
- an **agentic research workflow** that combines market data, technical analysis, forecasting, documents, and model-generated synthesis;
- an **auditable data-provenance layer** using SHA-256 history and optional RFC3161 timestamp anchoring.

## Core capabilities

| Area | What FinTerminal provides |
|---|---|
| Local data | CSV, Excel, Word, PDF, text, image/OCR ingestion, validation, cleaning, and file search |
| Visualization | 27+ built-in chart types, static output, interactive Plotly HTML, technical-analysis charts |
| Quant research | Descriptive statistics, correlation, group-by analysis, OLS, robust standard errors, hypothesis tests, VIF, event studies, DID, trend analysis, and backtesting |
| Market data | Quotes, multi-period K-lines, technical indicators, caching, provider fallback, and optional cross-checking |
| Forecasting | Linear, ARIMA, and ETS forecasting with automatic model selection where supported |
| RAG | Local vector retrieval, BM25 hybrid retrieval, reciprocal-rank fusion, document lifecycle operations, and citations |
| Agentic research | Multi-step research reports combining market data, indicators, forecasts, knowledge-base evidence, and AI synthesis with graceful degradation |
| Data provenance | File-change history, SHA-256 hash chaining, integrity verification, snapshots, and RFC3161 timestamp anchoring |
| Extensibility | Plugins for data sources, analysis types, and chart types without expanding the public MCP surface unnecessarily |
| Desktop | Electron + React + TypeScript interface backed by a packaged local FastAPI/Python service |

## MCP surface

FinTerminal exposes eight high-level tools:

| Tool | Purpose |
|---|---|
| `read` | Read local files or market data; optionally request K-lines, cross-checking, or forecasting |
| `detect` | Inspect files for format, encryption, corruption, or empty content |
| `clean` | Clean common tabular-data problems |
| `plot` | Create financial, statistical, and general-purpose visualizations |
| `analyze` | Run quantitative/statistical analysis and research-report workflows |
| `search` | Search and enumerate local research files |
| `chain` | Track and verify data provenance and timestamp anchors |
| `ask` | Natural-language orchestration across FinTerminal capabilities |

This compact surface is deliberate: agents see a small set of stable research primitives while FinTerminal handles lower-level routing internally.

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/lucaschang2021/finterminal.git
cd finterminal
```

### 2. Create an isolated Python environment

```bash
python -m venv .venv
```

Activate it with the command appropriate for your operating system, then install the dependencies used by the Python service.

> Dependency and packaging cleanup is ongoing. Until a fully reproducible installation path is published, treat `main` as development software and review the repository configuration before using external model or market-data providers.

### 3. Configure optional providers

Use `config.example.json` as the starting point for local configuration. Never commit API keys or credentials.

### 4. Desktop development

```bash
cd finterminal-desktop
npm install
npm run electron:dev
```

The desktop application uses Electron 33, React 18, TypeScript, Vite, ECharts, and a local FastAPI/Python backend. Production packaging builds the backend with PyInstaller and launches it as a child process from Electron.

## Desktop architecture

The desktop application follows a local-first architecture:

```text
Electron main process
        |
        +--> local Python / FastAPI backend
        |       |
        |       +--> research tools
        |       +--> market-data providers
        |       +--> RAG / local data
        |       +--> charts / reports / provenance
        |
        +--> React renderer
                |
                +--> authenticated localhost API
```

Important implementation choices include:

- Node integration disabled in the renderer;
- a per-launch random API token for the local backend;
- adaptive localhost ports when the default port is occupied;
- application-managed local data storage;
- graceful backend shutdown with process cleanup fallbacks;
- restricted file-serving behavior for generated outputs.

## Quantitative research

The unified analysis layer includes workflows for:

- descriptive statistics;
- Pearson correlation and significance testing;
- grouped statistics;
- OLS regression and robust standard errors;
- t-tests, ANOVA, and non-parametric tests where supported;
- trend and CAGR analysis;
- variance inflation factors;
- event-study abnormal returns and CAR;
- difference-in-differences estimation;
- signal-based strategy backtesting;
- research-report export to Markdown, DOCX, and PDF.

FinTerminal is research software. Statistical output should be independently validated before it is used for academic publication, investment decisions, or production systems.

## RAG and agentic research

FinTerminal includes a local knowledge layer combining semantic retrieval and BM25, with reciprocal-rank fusion and source attribution. Documents can be added, updated, removed, listed, and cleared through the research workflow.

The `ask` orchestration layer can combine current market data with historical research material. Agentic report generation is designed to degrade gracefully: if a market-data, charting, or forecasting step fails, remaining sections can continue and the missing component is identified rather than silently fabricated.

## Data provenance

Research reproducibility is a first-class goal. FinTerminal can track file changes in a SHA-256-linked history, verify integrity, maintain snapshots, and optionally anchor a chain head using RFC3161 trusted timestamps.

This is intended to help researchers answer questions such as:

- Which version of a dataset was used for an analysis?
- Has a tracked file changed since a previous research step?
- Can a research artifact be shown to have existed before a particular trusted timestamp?

It is **not** a blockchain network, custody system, or substitute for institutional compliance controls.

## Plugin system

The `plugins/` architecture allows contributors to extend selected capabilities without continuously increasing the number of MCP tools exposed to agents. Current extension areas include market-data providers, analysis types, and chart types.

This is one of the areas where external contributions are especially welcome.

## Project structure

```text
finterminal/
├── server.py                 # MCP entry point
├── api_server.py             # local HTTP/FastAPI bridge
├── analysis.py               # statistical analysis
├── charts.py                 # visualization
├── data_chain.py             # provenance and integrity
├── rag.py                    # local retrieval layer
├── plugins/                  # extension system
├── finterminal-desktop/      # Electron desktop application
├── frontend-legacy/          # archived earlier web prototype
├── tests/                    # automated tests
├── CONTRIBUTING.md
└── SECURITY.md
```

The exact structure may evolve as the project is modularized.

## Roadmap

Near-term open-source priorities include:

- reproducible installation and packaging documentation;
- broader automated test coverage;
- cleaner provider abstractions and additional data-source plugins;
- stronger evaluation of RAG and agentic research quality;
- improved English and Chinese documentation;
- reproducible release artifacts for the desktop application;
- community-reported issues and external contributions;
- continued security hardening of the local desktop/backend boundary.

## Contributing

FinTerminal is looking for contributors interested in financial data infrastructure, MCP, quantitative research, RAG, agentic workflows, desktop UX, testing, documentation, and reproducible research.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Bug reports and feature proposals can use the repository's GitHub issue templates.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Do not post API keys, credentials, private financial data, or sensitive local-file contents in public issues.

## License

A project license is being finalized as part of the OSS-readiness work. Until a license is published, the repository's source remains subject to applicable copyright law; public visibility alone does not grant open-source reuse rights.

## Disclaimer

FinTerminal is intended for research, education, experimentation, and developer tooling. It does not provide investment advice, brokerage, custody, payment, or fiduciary services. Market data can be delayed, incomplete, or incorrect, and model-generated research can contain errors. Independently verify important results.

---

If FinTerminal is useful to your research or development workflow, opening an issue with feedback, testing a release, contributing a provider/plugin, or starring the repository all help the project mature.
