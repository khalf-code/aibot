# Safety Model

## Principles

1. **No side effects in dev** unless explicitly enabled
2. **Approval required** for commit steps (send/submit/pay/delete/call external)
3. **No internet skill installs** — internal signed bundles only
4. **Tool allowlists** enforced by runtime, not developer promises
5. **Redaction by default** — secrets never leak into logs or UI

## Dev Profile (Default)

The dev profile (`config/profiles/dev.env`) blocks all external actions:

- External email/messaging: blocked
- Payment actions: blocked
- Voice calls: blocked
- n8n workflows: dry-run mode

## Approval Gates

High-risk actions require human approval via the dashboard queue:

- Sending external emails
- Submitting web forms
- Making payments
- Placing voice calls
- Deploying to production

## Tool Allowlists

Each skill's manifest declares which tools it can use. The runtime enforces these at execution time:

- CLI runner: only allowlisted commands
- Browser runner: commit-step gating (submit/pay/delete buttons pause for approval)
- Voice: only allowlisted contact groups

## Audit Trail

Every action is logged with: who, what, when, approval status, artifacts.
