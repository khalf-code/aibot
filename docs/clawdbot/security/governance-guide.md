# Security Governance Guide

This guide describes the Clawdbot security framework: a set of modules that enforce policy, audit, data protection, and access control across the runtime.

## Overview

The security framework consists of ten modules that work together to provide defence-in-depth:

| Module                 | Issue         | Purpose                                                 |
| ---------------------- | ------------- | ------------------------------------------------------- |
| Policy Engine          | SEC-001 (#75) | Declarative rule evaluation for allow/deny decisions    |
| Audit Log              | SEC-002 (#76) | Immutable structured logging of all significant actions |
| Data Retention         | SEC-003 (#77) | Time-based lifecycle management and purging             |
| PII Detection          | SEC-004 (#78) | Personally identifiable information tagging and masking |
| Secret Rotation        | SEC-005 (#79) | Managed credential lifecycle and renewal                |
| Signed Workflows       | SEC-006 (#80) | Cryptographic integrity for workflow definitions        |
| Risk Scoring           | SEC-007 (#81) | Quantitative risk assessment for approval gates         |
| Content Filters        | SEC-008 (#82) | Outbound content policy enforcement                     |
| SSO Integration        | SEC-009 (#83) | Single Sign-On with external identity providers         |
| Environment Separation | SEC-010 (#84) | Cross-environment access control                        |

## Architecture

All security modules are located under `src/clawdbot/security/` and exported via `src/clawdbot/security/index.ts`. They integrate with the existing Clawdbot runtime:

- **Policy Engine** is evaluated before tool invocations and workflow steps.
- **Audit Log** records events from every other module (tool calls, approvals, policy evaluations).
- **Data Retention** runs as a scheduled background task, purging expired records.
- **PII Detection** feeds into both the redaction pipeline (CORE-005) and content filters.
- **Secret Rotation** integrates with the vault used by the skill permissions system (SK-006).
- **Signed Workflows** extend the bundle signing approach (SK-003) to workflow definitions.
- **Risk Scoring** enhances the approval hooks (SK-005) with quantitative risk data.
- **Content Filters** run after generation but before delivery on all outbound channels.
- **SSO** provides identity for the audit log actor field and policy engine context.
- **Environment Separation** enforces boundaries using the config layering system (CORE-006).

## Policy Engine

The policy engine (`policy-engine.ts`) evaluates declarative rules against action context. Policies contain ordered rules with conditions and actions.

### Concepts

- **Policy**: A named set of rules with a default fallback action.
- **Rule**: An ordered entry with conditions (AND logic) and an action (allow, deny, require_approval).
- **Condition**: A field-operator-value comparison against the action context.
- **Action Context**: Key-value pairs describing what is being attempted (actor, tool, environment, etc.).

### Usage

```typescript
import { PolicyEngine } from "../clawdbot/security/index.js";

const engine = new PolicyEngine([
  {
    id: "outbound-policy",
    name: "Outbound message policy",
    version: "1.0.0",
    defaultAction: "deny",
    rules: [
      {
        id: "allow-internal",
        description: "Allow messages to internal channels",
        conditions: [{ field: "channel", operator: "in", value: ["slack", "discord"] }],
        action: "allow",
        priority: 10,
      },
    ],
  },
]);

const result = engine.evaluate("outbound-policy", { channel: "slack", actor: "bot" });
// result.action === "allow"
```

## Audit Logging

The audit log (`audit-log.ts`) provides an append-only event store. Every module should emit audit events for significant actions.

### Event Structure

Each event includes: actor, category, severity, summary, metadata, and optional run ID. Events are queryable by time range, category, severity, actor, and run.

### Categories

- `auth` -- authentication and authorization events
- `policy` -- policy evaluation outcomes
- `tool_invocation` -- tool/runner executions
- `approval` -- approval gate decisions
- `config_change` -- configuration modifications
- `data_access` -- data read/write operations
- `secret_access` -- vault and credential access
- `lifecycle` -- run start/stop/state transitions

## Data Retention

The data retention module (`data-retention.ts`) enforces time-based lifecycle policies. Default retention periods:

- **Audit logs**: 365 days (archived)
- **Run artifacts**: 90 days (deleted)
- **Session data**: 30 days (deleted)
- **PII**: 7 days (anonymised)
- **Chat history**: 180 days (archived)
- **Workflow state**: 60 days (deleted)

The `applyRetention()` function evaluates records against policies and returns a purge plan. Integrate with your data stores to execute the plan.

## PII Detection and Masking

The PII module (`pii.ts`) detects and masks personally identifiable information in text content.

### Supported PII Types

- Email addresses
- Phone numbers
- Social Security Numbers (SSN)
- Credit card numbers
- IP addresses
- Custom patterns (extensible)

### Masking Strategies

- **redact**: Replace with a placeholder (e.g. `[REDACTED]`)
- **partial**: Keep leading/trailing characters, mask the middle
- **hash**: Replace with a non-reversible hash
- **tokenise**: Replace with a reversible token (requires token vault)

## Secret Rotation

The secret rotation module (`secret-rotation.ts`) manages credential lifecycles. Each secret has a rotation schedule with an interval, last rotation timestamp, and status.

### Rotation Flow

1. `getDueRotations()` returns secrets that are due or overdue.
2. `rotate(secretId)` generates a new credential, stores it, and optionally revokes the old one.
3. The schedule is updated with the new rotation timestamp.

## Signed Workflows

The signed workflows module (`signed-workflows.ts`) provides cryptographic integrity for workflow definitions. Workflows are signed with Ed25519 (pending key management infrastructure) and verified before execution.

> **Note**: The `signWorkflow()` and `verifyWorkflow()` functions are stubs awaiting the key management infrastructure. They follow the same pattern as the skill bundle signing (SK-003).

## Risk Scoring

The risk scoring module (`risk-scoring.ts`) calculates a composite risk score (0-100) for actions that require approval.

### Risk Levels

| Level    | Score Range |
| -------- | ----------- |
| Low      | 0 - 29      |
| Medium   | 30 - 59     |
| High     | 60 - 79     |
| Critical | 80 - 100    |

### Built-in Risk Factors

- Production environment (+40, weight 1.0)
- External network access (+30, weight 0.8)
- PII involvement (+35, weight 0.9)
- State mutation (+20, weight 0.7)
- Financial transaction (+50, weight 1.0)

Custom evaluators can be passed to `calculateRiskScore()` for domain-specific factors.

## Content Filters

The content filter module (`content-filter.ts`) enforces outbound content policies. Rules are evaluated before any content is delivered to external channels.

### Filter Actions

- **allow**: Content passes through unchanged.
- **flag**: Content is allowed but flagged for review.
- **redact**: Matched spans are replaced with a placeholder.
- **block**: Content is prevented from being delivered.

### Default Rules

- Environment variable patterns are redacted.
- Common API key/secret patterns are redacted.
- Suspicious IP-based URLs are flagged.

## SSO Integration

The SSO module (`sso.ts`) defines the contract for Single Sign-On integration. Supported protocols:

- **SAML**: Enterprise SAML 2.0 assertions
- **OIDC**: OpenID Connect token exchange
- **OAuth 2.0**: Standard authorization code flow

The `SsoService` interface covers the full login lifecycle: initiate, callback, session validation, and logout.

## Environment Separation

The environment separation module (`env-separation.ts`) enforces boundaries between dev, staging, and production environments.

### Default Boundary Rules

- **Same environment**: Always allowed.
- **Dev to Staging**: Allowed (read-only, audit logged).
- **Staging to Dev**: Allowed (read-only).
- **Dev to Prod**: Never allowed.
- **Staging to Prod**: Allowed with approval, time-limited (1 hour), audit logged.
- **Prod to Dev/Staging**: Allowed (read-only, audit logged).

### Boundary Conditions

Conditions are checks that must be satisfied even when access is allowed:

- `requires_approval` -- human approval gate
- `read_only` -- no writes permitted
- `audit_logged` -- all access recorded
- `time_limited` -- access expires after a TTL
- `never` -- unconditional denial

## Integration Checklist

When adding a new tool runner or channel to Clawdbot, ensure the following security modules are wired in:

1. Register policy rules for the new tool/channel in the policy engine.
2. Emit audit events for tool invocations and results.
3. Apply PII detection to any user-provided input.
4. Run outbound content through the content filter before delivery.
5. Validate environment boundaries for cross-env operations.
6. Include the tool in risk scoring factor evaluators if it has side effects.
7. Rotate any new secrets on the configured schedule.
