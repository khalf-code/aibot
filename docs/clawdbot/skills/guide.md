# Skills Guide

## What is a Skill?

A skill is a small, composable unit of automation. Each skill does one thing well and can be chained into workflows via n8n.

## Skill Structure

```
skills/
  <skill-name>/
    manifest.yaml    # Permissions, secrets, tools, approvals
    src/             # Implementation
    tests/           # Test fixtures
    fixtures/        # Sandbox inputs/outputs
    README.md        # Usage and failure modes
```

## Manifest Schema (v1)

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
    - "*" # needs web access
approval_required: false
timeout_ms: 30000
```

## Building Your First Skill

1. Copy the template: `cp -r skills/_template skills/my-skill`
2. Edit `manifest.yaml` with your permissions
3. Implement in `src/`
4. Add test fixtures in `fixtures/`
5. Run sandbox tests: `pnpm skill:test my-skill`
6. Submit PR for review and signing
