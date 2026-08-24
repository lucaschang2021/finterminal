# Contributing to FinTerminal

Thank you for your interest in FinTerminal. Contributions that improve financial research workflows, MCP interoperability, data reliability, documentation, testing, and the desktop experience are welcome.

## Before you start

- Search existing issues before opening a new one.
- Keep changes focused and avoid unrelated refactors in the same pull request.
- Never commit API keys, credentials, private financial data, or generated local datasets.
- For substantial architectural changes, open an issue first so the design can be discussed before implementation.

## Development setup

### MCP / Python service

1. Fork and clone the repository.
2. Create a Python virtual environment.
3. Install the dependencies documented in the project README.
4. Copy `config.example.json` to your local configuration and add only the credentials you need.
5. Run the relevant tests before submitting a pull request.

### Desktop application

```bash
cd finterminal-desktop
npm install
npm run electron:dev
```

## Pull requests

A good pull request should:

- Explain the problem and the proposed solution.
- Describe user-visible behavior changes.
- Include tests or a reproducible validation procedure where practical.
- Update documentation when interfaces, configuration, or behavior changes.
- Avoid committing build outputs, secrets, caches, or local user data.

## Areas where help is especially useful

- Financial data-source adapters and reliability improvements
- MCP integrations and tool ergonomics
- Quantitative/statistical analysis and validation
- RAG and agentic research workflows
- Desktop UX, accessibility, and internationalization
- Tests, documentation, packaging, and reproducible releases

## Bug reports

Please include your operating system, FinTerminal version or commit, steps to reproduce, expected behavior, actual behavior, and relevant sanitized logs. Remove credentials and private financial data before posting.

## Community expectations

Be constructive, technically specific, and respectful. The goal is to make financial research tooling more reproducible, auditable, and accessible.
