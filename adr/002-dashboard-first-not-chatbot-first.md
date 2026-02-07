# ADR-002: Dashboard-First Product Direction (Not Chatbot-First)

## Status

Accepted

## Context

Clawdbot originated as a chat-based agent (via OpenClaw's messaging channels). As we scale to hundreds of skills and business workflows, the interface needs to support:

- Visibility into runs, approvals, and artifacts
- Workflow management and templates
- Skill registry and governance
- Secrets and RBAC management
- Audit trails

A chat interface cannot serve these needs. Operators need a control plane.

## Decision

**Build a dashboard as the primary interface.** Chat (Telegram, Slack, etc.) becomes optional I/O — a notification channel, not the product.

The dashboard is the control plane for:

- Runs (history, status, artifacts, replay)
- Workflows (n8n embedded editor, catalog, templates)
- Skills (registry, versions, permissions)
- Approvals (queue, risk labels, previews)
- Tools (email/calendar/browser/voice configs)
- Secrets (scoped, rotated, audited)
- RBAC (roles, permissions)

## Consequences

- Need to build a web application (React/Next.js or similar)
- Chat channels still useful for notifications and quick commands
- UX investment shifts from prompt engineering to UI/UX design
- Stitch directory contains design mockups and HTML prototypes for reference
