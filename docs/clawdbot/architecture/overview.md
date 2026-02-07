# Clawdbot Architecture Overview

Clawdbot is a dashboard-first business automation platform built on OpenClaw, with n8n as the embedded workflow engine.

## Core Components

### 1. Dashboard (Control Plane)

The primary interface — runs, workflows, skills, approvals, tools, secrets, RBAC.

### 2. Agent Runtime

Run state machine, idempotency, artifact storage, redaction pipeline.

### 3. Workflow Engine (n8n, embedded)

Visual workflow builder embedded via Nginx reverse proxy + iframe. Custom n8n nodes bridge to Clawdbot skills and tools.

### 4. Skill Framework

Internal registry of signed skill bundles. Each skill has a manifest, implementation, test fixtures, and observability hooks.

### 5. Tool Runners

CLI runner (allowlisted), browser runner (Playwright), email/calendar, voice, webhooks.

### 6. Governance & Security

Policy engine, approval gates, audit log, signed skills, RBAC.

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│                   Nginx                      │
│         (single origin reverse proxy)        │
│                                              │
│  /            → Dashboard (React)            │
│  /workflows/* → n8n (embedded editor)        │
│  /api/*       → Clawdbot API                 │
└─────────┬──────────────────┬────────────────┘
          │                  │
  ┌───────▼───────┐  ┌──────▼──────┐
  │   Dashboard   │  │    n8n      │
  │   (port 3000) │  │ (port 5678) │
  │               │  │             │
  │  Runs table   │  │ Visual      │
  │  Approvals    │  │ workflow    │
  │  Skills reg   │  │ editor     │
  │  Settings     │  │            │
  └───────┬───────┘  └──────┬─────┘
          │                  │
  ┌───────▼──────────────────▼─────┐
  │        Clawdbot Runtime        │
  │   (state machine, skills,      │
  │    tools, artifacts, policy)   │
  └───────┬────────────────────────┘
          │
  ┌───────▼──────────┐
  │  Postgres + Redis │
  └──────────────────┘
```

## Key Decisions

See `/adr/` for architecture decision records.
