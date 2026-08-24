# Development Guide

This guide describes the current contribution workflow for FinTerminal. It focuses on safe, reproducible development while the project is still being modularized.

## Repository areas

- Root Python modules: MCP service, analysis, market data, charts, knowledge/RAG, provenance, exports, and supporting utilities.
- `tests/`: pytest-based coverage for core analysis, API, charts, backtesting, provenance, market data, plugins, routing, and related helpers.
- `finterminal-desktop/`: Electron + React + TypeScript desktop application.
- `frontend-legacy/`: archived earlier web prototype; do not treat it as the primary UI.
- `plugins/`: extension points for selected providers, analysis types, and chart types.

## Development principles

1. **Keep deterministic computation separate from model-generated narrative.** Statistical results should not depend on an LLM unless the feature explicitly concerns interpretation.
2. **Fail visibly.** Provider, model, and plugin failures should not silently change research semantics.
3. **Preserve provenance.** Research artifacts should retain enough source/context information to be audited later.
4. **Prefer small public interfaces.** Extend internals or plugins before expanding the stable MCP surface unnecessarily.
5. **Do not commit secrets or private datasets.** Use local configuration and sanitized fixtures.

## Python workflow

FinTerminal declares its Python build metadata and dependencies in `pyproject.toml` and currently targets Python 3.13 or newer.

Create an isolated environment and install the development extra:

```bash
python -m venv .venv
```

Activate the environment, then run:

```bash
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e ".[dev]"
```

Optional feature groups can be installed independently:

```bash
python -m pip install -e ".[market]"
python -m pip install -e ".[kb]"
python -m pip install -e ".[vision]"
python -m pip install -e ".[charts]"
python -m pip install -e ".[anchor]"
```

For a broad local environment:

```bash
python -m pip install -e ".[all,dev]"
```

### Python validation

Run the same basic checks used by CI:

```bash
python -m compileall -q .
ruff check .
pytest
```

For focused development, run the narrowest relevant tests first:

```bash
pytest tests/test_analysis.py
pytest tests/test_data_chain.py
```

Network- or provider-dependent capabilities should remain optional and must not require credentials for the deterministic core test suite.

## Desktop workflow

```bash
cd finterminal-desktop
npm ci
npm run electron:dev
```

For CI-style renderer validation:

```bash
npm ci
npm run build
```

The standard build performs TypeScript validation and a Vite production build. Full Electron/Windows packaging is intentionally separate from the cross-platform CI check.

## Pull-request workflow

A contribution should normally follow:

```text
issue/discussion -> focused branch -> implementation -> tests -> documentation -> pull request -> review
```

Pull requests should explain:

- the research/developer problem being solved;
- behavior before and after the change;
- validation performed;
- failure/degraded-mode behavior;
- security/privacy implications where relevant;
- whether the MCP surface or persisted data format changes.

## High-risk change areas

Changes deserve extra review when they affect:

- desktop renderer ↔ local backend trust boundaries;
- arbitrary local-file access;
- API token handling or credentials;
- financial calculations/statistical estimators;
- provider fallback that could mix incompatible data semantics;
- provenance hashes/history/timestamps;
- agent routing that could hide missing evidence;
- data migration or persistent desktop storage.

## Versioning

FinTerminal is pre-1.0. Breaking changes may occur, but release metadata should remain aligned across `pyproject.toml`, `finterminal-desktop/package.json`, `CITATION.cff`, tags, and release notes. CI verifies the Python and desktop package versions match.
