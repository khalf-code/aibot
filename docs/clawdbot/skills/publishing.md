# Skill Publishing

This document describes the internal skill bundle format, how bundles are built and verified, and the CI pipeline that automates the process.

## Overview

Skills are packaged as signed `.tar.gz` bundles with companion metadata files. This stub pipeline handles building, hashing, and artifact upload. It does not yet handle registry publishing or signature verification -- those will be added in future iterations.

## Bundle Format

A skill bundle consists of two files:

```
dist/skills/
  <name>-<version>.tar.gz               # Compressed tarball of the skill directory
  <name>-<version>.bundle-metadata.json  # Build metadata and integrity hash
```

### Tarball Contents

The tarball contains the skill directory with all source files, preserving the directory structure:

```
<skill-name>/
  SKILL.md            # Skill descriptor (frontmatter + docs)
  manifest.yaml       # Optional standalone manifest
  src/                # Implementation files
  tests/              # Test fixtures
  fixtures/           # Sandbox inputs/outputs
  README.md           # Usage documentation
  scripts/            # Helper scripts
```

Hidden files (dotfiles), `__pycache__/`, `*.pyc`, `.git/`, and `node_modules/` are excluded automatically.

### Metadata JSON

The `bundle-metadata.json` file contains:

```json
{
  "name": "enrich-lead-website",
  "version": "1.0.0",
  "sha256": "a1b2c3d4e5f6...",
  "build_timestamp": "2026-02-07T12:00:00Z",
  "bundle_filename": "enrich-lead-website-1.0.0.tar.gz",
  "bundle_size_bytes": 12345,
  "files": ["enrich-lead-website/SKILL.md", "enrich-lead-website/src/index.ts"]
}
```

| Field               | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `name`              | Skill name from manifest or directory name           |
| `version`           | Skill version (defaults to `0.0.0` if not specified) |
| `sha256`            | SHA-256 hash of the `.tar.gz` file                   |
| `build_timestamp`   | UTC ISO 8601 timestamp of the build                  |
| `bundle_filename`   | Name of the tarball file                             |
| `bundle_size_bytes` | Size of the tarball in bytes                         |
| `files`             | Sorted list of all files included in the bundle      |

## Skill Descriptor

Skills declare metadata in one of two ways:

### SKILL.md Frontmatter (preferred)

```yaml
---
name: enrich-lead-website
description: Scrape a lead's website and extract key info
metadata:
  openclaw:
    emoji: "🔍"
    requires:
      bins:
        - browser-runner
---
```

### manifest.yaml (standalone)

```yaml
name: enrich-lead-website
version: 1.0.0
description: Scrape a lead's website and extract key info
permissions:
  tools:
    - browser-runner
  secrets:
    - none
  domains:
    - "*"
approval_required: false
timeout_ms: 30000
```

The build script checks for `manifest.yaml` first, then falls back to `SKILL.md` frontmatter. The `name` field is required; `version` defaults to `0.0.0` if not specified.

## Building a Bundle

### Locally

```bash
# Build a single skill
./scripts/build-skill-bundle.sh enrich-lead-website

# Output appears in dist/skills/
ls dist/skills/
# enrich-lead-website-1.0.0.tar.gz
# enrich-lead-website-1.0.0.bundle-metadata.json
```

### What the Script Does

1. Locates the skill directory under `skills/`
2. Reads `manifest.yaml` or `SKILL.md` frontmatter for name and version
3. Collects all non-hidden, non-junk files in the skill directory
4. Creates a `.tar.gz` tarball
5. Computes the SHA-256 hash of the tarball
6. Writes `bundle-metadata.json` with name, version, hash, timestamp, and file list
7. Prints a summary

## Verifying a Bundle

```bash
./scripts/verify-skill-bundle.sh dist/skills/enrich-lead-website-1.0.0.tar.gz
```

### Verification Checks

1. Bundle file exists and is a valid gzip archive
2. Companion `bundle-metadata.json` exists alongside the bundle
3. SHA-256 hash of the tarball matches the recorded value in metadata
4. Bundle contains a manifest (`manifest.yaml` or `SKILL.md`)
5. Manifest includes required fields (`name`, `description`)

The script exits with code 0 on success and code 1 on any failure, printing `[PASS]` or `[FAIL]` for each check.

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/build-skill-bundle.yml`) runs automatically when files under `skills/` change.

### Workflow Steps

1. **Discover** -- Compares the current commit against the base to find which skill directories changed
2. **Build** -- Runs `build-skill-bundle.sh` for each changed skill (in parallel via matrix strategy)
3. **Verify** -- Runs `verify-skill-bundle.sh` against each built bundle
4. **Upload** -- Uploads the bundle and metadata as CI artifacts (retained for 30 days)

### Triggers

- Push to `main` that touches `skills/**`
- Pull requests that touch `skills/**`

### Downloading Artifacts

After a successful CI run, bundles are available as downloadable artifacts in the GitHub Actions UI under the name `skill-bundle-<skill-name>`.

## Future Work

- **Registry publishing**: push verified bundles to an internal registry
- **Bundle signing**: cryptographic signatures for supply-chain integrity
- **Version conflict detection**: prevent duplicate name+version pairs
- **Dependency resolution**: declare and resolve inter-skill dependencies
- **Size limits and policy gates**: enforce maximum bundle sizes and required review
