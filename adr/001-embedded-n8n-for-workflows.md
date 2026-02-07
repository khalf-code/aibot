# ADR-001: Use Embedded n8n for Workflow Orchestration

## Status

Accepted

## Context

Clawdbot needs a workflow engine to chain skills into multi-step automations. We evaluated:

1. **Custom DSL/engine** — Build our own YAML-based workflow DSL with a custom runner
2. **n8n (standalone)** — Deploy n8n as a separate app alongside the dashboard
3. **n8n (embedded)** — Deploy n8n behind a reverse proxy and embed its editor in the Clawdbot dashboard via iframe

## Decision

**Option 3: Embedded n8n via Nginx reverse proxy.**

Architecture:

```
Nginx (single origin)
  /              → Clawdbot dashboard
  /workflows/*   → n8n editor
```

We build a custom n8n node package (`n8n-nodes-clawdbot`) to expose skills, tools, and approval gates as native n8n nodes.

## Rationale

- n8n provides a visual workflow builder, 400+ integrations, triggers, retries, and branching out of the box
- Embedding via reverse proxy gives users a single login and unified UI
- Self-hosted community edition = no vendor lock-in, no per-execution costs
- Custom nodes bridge n8n to our skill/tool runtime without forking n8n
- Avoids months of custom engine development

## Consequences

- Depends on n8n's release cycle for editor features
- Custom nodes need maintenance when n8n's node API changes
- n8n community edition license (sustainable use) applies — review for compliance
- Dashboard owns navigation/approvals/runs; n8n iframe owns the workflow canvas
