# Workflows Guide

## Overview

Workflows are built in n8n's visual editor, embedded in the Clawdbot dashboard. They chain skills, tools, and approval gates into multi-step business automations.

## Accessing the Workflow Editor

1. Open the Clawdbot dashboard
2. Click "Workflows" in the sidebar
3. The n8n visual editor loads in the main content area
4. Drag Clawdbot custom nodes from the palette to build your workflow

## Clawdbot Custom Nodes

The `n8n-nodes-clawdbot` package provides:

- **Clawdbot Skill** — Invoke any registered skill
- **Clawdbot Approval Gate** — Pause for human approval via the dashboard queue
- **Clawdbot Artifact** — Store screenshots, transcripts, exports as run artifacts

## Workflow Templates

Pre-built templates live in `workflows/templates/` organized by business function:

- `sales/` — Lead intake, enrichment, outreach
- `support/` — Ticket triage, response drafting
- `finance/` — Invoice processing, expense matching
- `ops/` — Health checks, credential rotation

Deploy a template from the dashboard with one click.

## Simulation Mode

Click "Simulate" to dry-run a workflow. Clawdbot nodes return fixture data without side effects. A banner shows "DRY RUN — No side effects executed."
