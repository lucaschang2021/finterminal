# FinTerminal Architecture

This document gives contributors a high-level map of the project. It intentionally describes stable responsibilities rather than every internal function.

## System overview

FinTerminal has two primary entry surfaces:

1. **MCP service** for AI clients and research agents.
2. **Windows desktop application** built with Electron/React and backed by a local Python/FastAPI service.

Both surfaces reuse the same research capabilities: file ingestion, quantitative analysis, market-data access, visualization, RAG, agentic research, and data provenance.

```text
AI client / MCP host                 Desktop user
        |                                 |
        v                                 v
   MCP server                       Electron renderer
        |                                 |
        |                           authenticated localhost API
        |                                 |
        +--------------+------------------+
                       v
              Python research layer
                       |
      +----------------+--------------------+
      |                |                    |
      v                v                    v
 local files      market providers      knowledge/RAG
      |                |                    |
      +--------+-------+---------+----------+
               |                 |
               v                 v
         analysis/charts     provenance chain
               |
               v
        reports / artifacts
```

## Core responsibilities

### MCP orchestration

The public MCP surface is intentionally compact. Higher-level tools such as `read`, `plot`, `analyze`, `chain`, and `ask` route into more specialized internal modules. Keeping the public surface small reduces tool-selection overhead for AI agents and gives the project room to evolve internals without continuously expanding schemas.

### Local HTTP bridge

`api_server.py` exposes selected research functionality to the desktop application. The desktop runtime is designed around localhost communication rather than a remote hosted backend.

### Quantitative analysis

`analysis.py` and related modules provide reusable statistical and research workflows. This layer should remain deterministic where possible and should clearly separate statistical computation from model-generated narrative.

### Visualization

`charts.py` and chart-data helpers convert research inputs into static or interactive visual outputs. Chart generation should remain reproducible from explicit parameters and source data.

### Market data

Market-data code supports multiple providers, caching, fallback behavior, technical indicators, and optional cross-checking. Provider-specific failures should degrade clearly rather than silently changing data semantics.

### Knowledge and RAG

The local knowledge layer supports document ingestion, hybrid retrieval, and source attribution. Retrieval output should preserve enough provenance for a user to distinguish source evidence from model synthesis.

### Agentic research

The agentic workflow coordinates multiple research steps. A key design principle is graceful degradation: if one upstream source or analysis fails, remaining sections may continue, but the missing step should be disclosed.

### Data provenance

`data_chain.py` tracks file history using cryptographic hashes and can optionally anchor chain heads with RFC3161 timestamps. This is a reproducibility and integrity feature, not a blockchain network or institutional compliance product.

## Desktop security boundary

The Electron desktop application follows several local security principles:

- renderer Node integration should remain disabled;
- the local backend should require a per-launch authentication token;
- file-serving endpoints should stay scoped to application-managed outputs;
- arbitrary file access from the renderer should not be introduced casually;
- shutdown and cleanup paths should avoid leaving stale backend processes;
- secrets belong in local configuration, never in the repository.

Changes that weaken these boundaries should be called out explicitly in pull requests.

## Extension strategy

The plugin system is the preferred route for adding provider, analysis, or visualization capabilities that do not justify expanding the stable MCP surface. Plugins should fail in isolation and should not make unrelated core workflows unavailable.

## Architectural priorities

Near-term priorities are:

1. reproducible Python dependency management;
2. stronger automated tests and CI;
3. clearer interfaces between provider, analysis, and orchestration layers;
4. stronger evaluation of agentic/RAG quality;
5. reliable release and desktop packaging workflows;
6. continued hardening of the local desktop/backend boundary.
