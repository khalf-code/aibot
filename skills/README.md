# Skills

Skills are small, composable units of automation. Each skill does one thing well and can be chained into workflows.

## Directory Structure

```
skills/
  <skill-name>/
    manifest.yaml    # Required: name, version, description, permissions
    SKILL.md         # Agent-facing instructions (frontmatter + usage docs)
    README.md        # Human-facing documentation
    src/             # Implementation source code
    tests/           # Unit and integration tests
    fixtures/        # Sample inputs/outputs for sandbox testing
```

## Manifest Schema (v1)

Every skill **must** contain a `manifest.yaml` at its root. The manifest declares metadata and permissions so the discovery pipeline can validate and register the skill automatically.

### Required Fields

| Field         | Type   | Description                             |
| ------------- | ------ | --------------------------------------- |
| `name`        | string | Unique kebab-case identifier            |
| `version`     | string | SemVer version (e.g. `1.0.0`)           |
| `description` | string | One-line summary of what the skill does |

### Optional Fields

| Field                 | Type     | Description                                       |
| --------------------- | -------- | ------------------------------------------------- |
| `permissions.tools`   | string[] | Tools the skill needs access to                   |
| `permissions.secrets` | string[] | Secret names required at runtime                  |
| `permissions.domains` | string[] | Network domains the skill may contact             |
| `approval_required`   | boolean  | Whether human approval is needed before execution |
| `timeout_ms`          | number   | Maximum execution time in milliseconds            |

### Example

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

## Conventions

- Skill names use **kebab-case** (e.g. `enrich-lead-website`).
- Each skill is self-contained: all source, tests, and fixtures live within its directory.
- Existing skills that only contain a `SKILL.md` are agent-instruction-only skills (no manifest needed yet). The `manifest.yaml` convention is for skills with executable implementations.
- The `scripts/discover-skills.sh` script walks this directory and validates all manifests automatically.

## Discovery

Run the discovery script to find and validate all skills with manifests:

```bash
bash scripts/discover-skills.sh
```

The script:

1. Walks every subdirectory under `skills/`
2. Finds directories containing a `manifest.yaml`
3. Validates that each manifest has the required fields (`name`, `version`, `description`)
4. Prints a summary table of discovered skills
5. Exits non-zero if any manifest is invalid

## Creating a New Skill

1. Create a directory under `skills/` with a kebab-case name.
2. Add a `manifest.yaml` with at least `name`, `version`, and `description`.
3. Implement your skill in `src/`.
4. Add test fixtures in `fixtures/` (sample `input.json` and `output.json`).
5. Write tests in `tests/`.
6. Add a `README.md` documenting usage and failure modes.
7. Run `bash scripts/discover-skills.sh` to verify your manifest is valid.
8. Submit a PR for review.
