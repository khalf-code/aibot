# Clawdbot Release Process

This document describes how to cut a new Clawdbot release using the `scripts/release.sh` helper.

## Prerequisites

- A clean git working tree (no uncommitted changes).
- Node 22+ and pnpm installed (for running the test suite before releasing).
- The `gh` CLI installed (optional, for creating GitHub releases).

## Version Scheme

Clawdbot uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

| Segment   | When to bump                              |
| --------- | ----------------------------------------- |
| **MAJOR** | Incompatible API or behavioral changes    |
| **MINOR** | New features that are backward-compatible |
| **PATCH** | Bug fixes and minor improvements          |

Pre-release suffixes (e.g. `1.0.0-beta.1`, `1.0.0-rc.1`) are supported.

## Files Involved

| File                    | Purpose                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `VERSION`               | Single-line file containing the current semver version                                                   |
| `CLAWDBOT_CHANGELOG.md` | Changelog generated from conventional commits (prefixed to avoid conflicts with the main `CHANGELOG.md`) |
| `scripts/release.sh`    | Release automation script                                                                                |

## Step-by-Step

### 1. Validate and prepare

Make sure the working tree is clean and all tests pass:

```bash
pnpm build
pnpm check
pnpm test
```

### 2. Choose the next version

Decide the next version number based on the changes since the last release. Check the current version:

```bash
cat VERSION
```

### 3. Run the release script

```bash
./scripts/release.sh <version>
```

For example:

```bash
./scripts/release.sh 0.1.0
```

The script will:

1. Validate the version string against semver.
2. Ensure the working tree is clean.
3. Update the `VERSION` file with the new version.
4. Parse the git log since the last tag and generate a new section in `CLAWDBOT_CHANGELOG.md`, grouped by conventional-commit type (feat, fix, docs, chore, refactor, perf, test).
5. Commit the `VERSION` and `CLAWDBOT_CHANGELOG.md` changes with message `chore(release): <version>`.
6. Create an annotated git tag `v<version>`.
7. Print instructions for pushing.

### 4. Push the release

After the script completes, push the commit and tag:

```bash
git push origin main
git push origin v<version>
```

### 5. Create a GitHub release (optional)

Use the GitHub CLI to create a release with auto-generated notes:

```bash
gh release create v<version> --generate-notes
```

Or create a release manually at `https://github.com/openclaw/openclaw/releases/new`.

## Conventional Commits

The changelog generator groups commits by their conventional-commit prefix. Use these prefixes in commit messages for accurate categorisation:

| Prefix                            | Changelog section |
| --------------------------------- | ----------------- |
| `feat:` or `feat(scope):`         | Added             |
| `fix:` or `fix(scope):`           | Fixed             |
| `docs:` or `docs(scope):`         | Documentation     |
| `refactor:` or `refactor(scope):` | Refactored        |
| `perf:` or `perf(scope):`         | Performance       |
| `test:` or `test(scope):`         | Tests             |
| `chore:`, `ci:`, `build:`         | Chores            |
| everything else                   | Other             |

## Recovering from Mistakes

### Wrong version tagged

Delete the local tag and re-run:

```bash
git tag -d v<wrong-version>
git reset --soft HEAD~1       # undo the release commit
./scripts/release.sh <correct-version>
```

If the tag was already pushed:

```bash
git push origin :refs/tags/v<wrong-version>
```

### Amending the changelog

Edit `CLAWDBOT_CHANGELOG.md` manually, commit, and force-update the tag:

```bash
git add CLAWDBOT_CHANGELOG.md
git commit -m "docs(changelog): fix release notes for <version>"
git tag -f -a v<version> -m "Release <version>"
git push origin v<version> --force
```

## Relationship to Main CHANGELOG.md

The main `CHANGELOG.md` in the repository root is maintained manually by the OpenClaw project and tracks the broader product releases (date-based versioning like `2026.2.6`). The `CLAWDBOT_CHANGELOG.md` is specifically for Clawdbot's semver-tagged releases and is auto-generated from conventional commits. The two changelogs serve different audiences and release cadences.
