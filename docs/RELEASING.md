# Release Process

FinTerminal is currently pre-1.0. The purpose of this process is to make releases reproducible and auditable even while interfaces are still evolving.

## Before a release

1. Update `CHANGELOG.md` with user-visible changes.
2. Confirm version metadata is consistent across components that will be distributed.
3. Ensure the target commit is on `main` and CI is green.
4. Run relevant Python tests locally, especially for changed statistical, provenance, routing, or provider behavior.
5. Run the desktop renderer build:

```bash
cd finterminal-desktop
npm ci
npm run build
```

6. For a Windows desktop release, perform the project packaging workflow on the supported Windows build environment.
7. Test the packaged application on a clean or representative user environment where practical.

## Release notes

Release notes should contain:

- a short summary of the release;
- notable features and fixes;
- breaking or behavior-changing updates;
- security-relevant changes;
- known limitations;
- upgrade or data-directory notes when applicable;
- the exact commit/tag used to build artifacts.

## Artifacts

Desktop artifacts should be generated from a clean checkout of the tagged commit. Future release automation should publish cryptographic checksums alongside distributable binaries so users can verify downloads.

Do not publish configuration files containing credentials, local datasets, user research files, caches, or model/provider secrets.

## Versioning

Before 1.0, FinTerminal uses semantic-version-like releases pragmatically:

- patch: fixes and compatible improvements;
- minor: meaningful new capabilities or interface evolution;
- major/1.0: reserved for a substantially stabilized public contract.

Any breaking change should still be called out explicitly regardless of the numerical version bump.

## Post-release

- verify the release page and artifacts;
- update citation metadata if the cited project version changes;
- check that installation/documentation links still reflect reality;
- triage early user reports before beginning unrelated large refactors.
