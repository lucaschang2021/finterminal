# Security Policy

FinTerminal handles local files, financial data, external data providers, optional model APIs, and a desktop-to-local-backend bridge. Security reports are taken seriously.

## Supported versions

Security fixes are currently targeted at the latest published release and the current `main` branch.

## Reporting a vulnerability

Please do **not** open a public issue for a vulnerability that could expose credentials, private data, arbitrary local files, or enable code execution.

Instead, use GitHub's private vulnerability reporting feature if it is enabled for this repository. If private reporting is unavailable, contact the maintainer privately through the contact method listed on the maintainer's GitHub profile and include `FinTerminal security` in the subject or opening line.

Please include:

- A concise description of the issue
- Affected version or commit
- Reproduction steps or proof of concept
- Expected security impact
- Any suggested mitigation

Do not include real API keys, credentials, or private financial datasets in a report.

## Security model

FinTerminal is designed as a local-first application. The desktop renderer does not receive unrestricted Node.js access, the local API uses a per-launch bearer token, and file-serving endpoints are intended to remain scoped to application-managed output paths. Optional third-party APIs and model providers remain subject to their own security and privacy policies.

FinTerminal is research software and should not be treated as a custody, brokerage, payment, or production trading system without independent security review.
