# ADR-003: Internal Skill Registry Only (No Public Marketplace)

## Status

Accepted

## Context

Skills are the core building blocks of Clawdbot. They wrap CLI commands, browser automations, API calls, and business logic into reusable atoms. We need a distribution model.

Options:

1. **Public marketplace** — Allow anyone to publish skills (npm-style)
2. **Internal registry only** — Only signed internal bundles accepted

## Decision

**Option 2: Internal registry only.**

- Skills are published as signed bundles from this repo
- No external/public skill installation
- Each skill ships with: manifest, implementation, test fixtures, observability hooks, docs
- Runtime enforces manifest-declared permissions (allowed tools, secrets, domains)

## Rationale

- Skills can be dangerous (they execute CLI commands, automate browsers, send emails)
- Public directories introduce supply-chain attack surface
- Internal-only means we control quality, security, and compatibility
- Signing ensures tamper detection

## Consequences

- All skills must be developed in-house or reviewed before inclusion
- Need a build/sign/publish pipeline for skill bundles
- Skill manifest schema becomes a critical contract
- Community contributions go through PR review, not marketplace upload
