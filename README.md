# FinTerminal

**Local-first AI financial research infrastructure built around MCP, quantitative analysis, RAG, agentic research, and auditable data provenance.**

[简体中文](README.zh-CN.md) · [Architecture](docs/ARCHITECTURE.md) · [Development](docs/DEVELOPMENT.md) · [Roadmap](docs/ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Apache-2.0](LICENSE)

> **Status:** FinTerminal is an early-stage open-source project. Interfaces and research workflows may evolve quickly. Feedback, bug reports, integrations, and contributions are welcome.

## Why FinTerminal?

Financial research often lives across spreadsheets, PDFs, market-data websites, notebooks, charting tools, and AI chat windows. FinTerminal brings those workflows into one local-first research layer that AI clients can access through the Model Context Protocol (MCP).

FinTerminal can be used as:

- an **MCP server** for AI-assisted financial research;
- a **Windows desktop research terminal** with a local Python backend;
- a **quantitative analysis toolkit** for common research workflows;
- a **local RAG knowledge base** with source attribution;
- an **agentic research workflow** combining market data, documents, indicators, forecasts, and AI synthesis;
- an **auditable data-provenance layer** using SHA-256 history and optional RFC3161 timestamp anchoring.

## Core capabilities

| Area | What FinTerminal provides |
|---|---|
| Local data | CSV, Excel, Word, PDF, text, image/OCR ingestion, validation, cleaning, and file search |
| Visualization | 27+ built-in chart types, static output, interactive Plotly HTML, technical-analysis charts |
| Quant research | Descriptive statistics, correlation, OLS, robust standard errors, tests, VIF, event studies, DID, trend analysis, and backtesting |
| Market data | Quotes, multi-period K-lines, indicators, caching, provider fallback, and optional cross-checking |
| Forecasting | Linear, ARIMA, and ETS forecasting with automatic model selection where supported |
| RAG | Local vector retrieval, BM25 hybrid retrieval, reciprocal-rank fusion, document lifecycle operations, and citations |
| Agentic research | Multi-step research reports with graceful degradation when a provider or research step fails |
| Data provenance | File-change history, SHA-256 hash chaining, integrity verification, snapshots, and RFC3161 timestamp anchoring |
| Extensibility | Plugins for data sources, analysis types, and chart types |
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

The compact surface is deliberate: agents see a small set of stable research primitives while lower-level routing stays internal.

## Quick start

### Python / MCP service

FinTerminal currently targets **Python 3.13+**.

```bash
git clone https://github.com/lucaschang2021/finterminal.git
cd finterminal
python -m venv .venv
```

Activate the virtual environment, then install the project:

```bash
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e .
```

For development and tests:

```bash
python -m pip install -e ".[dev]"
ruff check .
pytest
```

Optional feature groups are declared in `pyproject.toml`, including `market`, `kb`, `vision`, `charts`, `llm`, and `anchor`. A broad environment can be installed with:

```bash
python -m pip install -e ".[all,dev]"
```

Use `config.example.json` as the starting point for provider configuration. Never commit credentials or private datasets.

### Desktop development

```bash
cd finterminal-desktop
npm ci
npm run electron:dev
```

For a CI-style renderer build:

```bash
npm run build
```

## Desktop architecture

```text
Electron main process
        |
        +--> local Python / FastAPI backend
        |       |
        |       +--> research tools
        |       +--> market-data providers
        |       +--> knowledge / local data
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

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the broader system model.

## Quantitative research

The analysis layer includes workflows for descriptive statistics, Pearson correlation, grouped statistics, OLS regression, robust standard errors, hypothesis tests, trend/CAGR analysis, VIF, event studies, difference-in-differences, strategy backtesting, and report export.

FinTerminal is research software. Statistical output should be independently validated before academic publication, investment decisions, or production use.

## RAG and agentic research

FinTerminal includes a local knowledge layer combining semantic retrieval and BM25 with reciprocal-rank fusion and source attribution. The `ask` orchestration layer can combine current market data with historical research material and is designed to degrade visibly rather than silently fabricate missing sections.

## Data provenance

FinTerminal can track file changes in a SHA-256-linked history, verify integrity, maintain snapshots, and optionally anchor a chain head using RFC3161 trusted timestamps.

This is intended to improve research reproducibility. It is **not** a blockchain network, custody system, or substitute for institutional compliance controls.

## Project structure

```text
finterminal/
├── mcp_server.py             # MCP service and orchestration
├── api_server.py             # local FastAPI bridge
├── reader.py                 # file ingestion and parsing
├── routing.py                # intent/data-source routing
├── analysis.py               # statistical analysis
├── charts.py                 # visualization
├── market_data.py            # quote/K-line/provider logic
├── knowledge.py              # local knowledge/RAG workflows
├── data_chain.py             # provenance and integrity
├── plugin_manager.py         # plugin loading
├── plugins/                  # extensions
├── finterminal-desktop/      # Electron desktop application
├── frontend-legacy/          # archived earlier web prototype
├── tests/                    # pytest suite
├── pyproject.toml            # Python packaging and dependencies
└── .github/workflows/        # CI and release validation
```

## Engineering quality

Pull requests and pushes to `main` are checked with GitHub Actions for repository hygiene, version alignment, Python installation, source compilation, Ruff, pytest, and the desktop TypeScript/Vite build.

Release tags additionally pass a release gate that validates version metadata and builds Python and desktop-renderer artifacts before they are treated as release candidates.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for current priorities. Near-term work includes stronger test classification, provider abstraction, research-quality evaluation, packaging/release hardening, documentation, and external contributor adoption.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) before opening a pull request.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Do not post API keys, credentials, private financial data, or sensitive local-file contents in public issues.

## License

FinTerminal is licensed under the [Apache License 2.0](LICENSE).

## Disclaimer

FinTerminal is intended for research, education, experimentation, and developer tooling. It does not provide investment advice, brokerage, custody, payment, or fiduciary services. Market data can be delayed, incomplete, or incorrect, and model-generated research can contain errors. Independently verify important results.

---

If FinTerminal is useful to your research or development workflow, opening an issue with feedback, testing a release, contributing a provider/plugin, or starring the repository all help the project mature.
