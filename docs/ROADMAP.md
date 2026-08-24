# FinTerminal Roadmap

This roadmap communicates priorities rather than fixed delivery dates. FinTerminal is early-stage software, so sequencing may change as real users, contributors, and maintainers surface better evidence.

## Phase 1 — Reproducible core

Goal: make a fresh clone understandable, testable, and maintainable by someone other than the original author.

- publish reproducible Python dependency management;
- document supported Python and Node versions;
- make the primary MCP service install/run path deterministic;
- keep configuration examples free of secrets;
- classify tests into fast/core/integration/provider-dependent groups;
- add CI for deterministic checks that do not require private credentials;
- keep release notes and version metadata consistent across components.

## Phase 2 — Research reliability

Goal: make outputs easier to verify and compare.

- expand fixtures for quantitative-analysis tests;
- strengthen regression, event-study, DID, forecasting, and backtest validation;
- make data-source attribution visible throughout research workflows;
- document provider fallback and caching semantics;
- improve degraded-mode reporting when providers or models fail;
- add reproducible examples for research reports and charts.

## Phase 3 — RAG and agentic evaluation

Goal: measure research quality rather than relying on demos alone.

- create a small public evaluation set where licensing permits;
- test retrieval relevance and citation correctness;
- separate source evidence from model-generated interpretation;
- measure agent tool-selection and failure recovery;
- add regression tests for routing and multi-step research workflows;
- document model/provider assumptions behind evaluation results.

## Phase 4 — Extensible ecosystem

Goal: make FinTerminal useful beyond the maintainer's own environment.

- stabilize plugin contracts for market data, analysis, and charts;
- publish one or more reference plugins;
- document extension lifecycle and failure isolation;
- improve MCP-client integration examples;
- accept community-maintained provider adapters where maintainable.

## Phase 5 — Desktop distribution

Goal: provide a safer, reproducible desktop release process.

- automate frontend build validation;
- make Windows packaging reproducible;
- publish checksums for release artifacts;
- document upgrade and data-directory behavior;
- continue Electron/FastAPI boundary hardening;
- improve accessibility and internationalization.

## Community milestones

FinTerminal will treat adoption evidence as a product signal, not a vanity metric. Useful milestones include:

- first external bug reports with reproducible fixes;
- first external pull request;
- first community plugin/provider adapter;
- repeat users across multiple releases;
- documented downstream MCP integrations;
- independent reproduction of research workflows.

Stars and forks are welcome, but real usage, issues, contributions, and reproducible feedback matter more.
