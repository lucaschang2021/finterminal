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

The repository already contains a broad pytest suite, but dependency management is still being consolidated into a reproducible install path. Until that work is complete:

- use an isolated virtual environment;
- install only dependencies required by the area you are changing;
- avoid committing environment-specific lock artifacts unless they are part of an agreed packaging change;
- run the narrowest relevant tests first, followed by the broader suite when practical.

Example:

```bash
python -m venv .venv
pytest tests/test_analysis.py
pytest tests/test_data_chain.py
pytest
```

Some tests or integrations may depend on optional local/provider capabilities. A future milestone is to classify the suite explicitly into deterministic core tests and credential/network-dependent integration tests.

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

FinTerminal is pre-1.0. Breaking changes may occur, but releases should still document user-visible changes in `CHANGELOG.md` and keep desktop/package release metadata aligned where practical.
