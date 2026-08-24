# Release Process

FinTerminal is currently pre-1.0. Releases are designed to be reproducible and auditable while interfaces are still evolving.

## Release contract

The canonical project version must match in:

- `pyproject.toml`
- `finterminal-desktop/package.json`
- the Git tag, formatted as `v<version>`

The release workflow rejects a tag that does not match project metadata.

## Before a release

1. Update `CHANGELOG.md` with user-visible changes.
2. Update the Python and desktop version metadata together.
3. Confirm the target commit is on `main` and the OSS quality workflow is green.
4. Review breaking changes, security implications, migration notes, and known limitations.
5. Create and push the matching version tag only after the release commit is merged.

Example for version `0.1.1`:

```bash
git checkout main
git pull --ff-only
git tag -a v0.1.1 -m "FinTerminal v0.1.1"
git push origin v0.1.1
```

## Automated release gate

A `v*` tag triggers `.github/workflows/release-gate.yml`. The workflow:

1. verifies Python, desktop, and tag versions agree;
2. builds Python source and wheel distributions;
3. installs desktop dependencies from the lockfile;
4. type-checks and builds the desktop renderer;
5. generates `SHA256SUMS.txt` for built artifacts;
6. stores build outputs as GitHub Actions artifacts;
7. creates a GitHub Release with generated release notes;
8. attaches the Python distributions and checksum manifest to the GitHub Release.

`workflow_dispatch` can be used to exercise the build gate without publishing a GitHub Release.

## Windows desktop installer

The current automated release gate validates and archives the cross-platform renderer build. It does **not** claim to produce a supported Windows installer from Linux.

A Windows installer must be produced from the project's supported Windows packaging environment, then tested on a clean or representative Windows machine before it is advertised as a supported binary release. Automating that Windows build is a future release-engineering milestone.

## Release notes

Release notes should identify:

- notable features and fixes;
- breaking or behavior-changing updates;
- security-relevant changes;
- known limitations;
- upgrade or data-directory notes when applicable;
- the exact commit/tag used for the release.

Never publish configuration files containing credentials, local datasets, user research files, caches, or provider secrets.

## Versioning

Before 1.0, FinTerminal uses semantic-version-like releases pragmatically:

- patch: fixes and compatible improvements;
- minor: meaningful new capabilities or interface evolution;
- `1.0`: reserved for a substantially stabilized public contract.

Breaking changes must still be called out explicitly regardless of the numerical version bump.

## Post-release

- verify the GitHub Release page and attached artifacts;
- verify `SHA256SUMS.txt` against downloaded artifacts;
- update citation metadata when the cited project version changes;
- confirm installation and documentation links remain accurate;
- triage early user reports before beginning unrelated large refactors.
