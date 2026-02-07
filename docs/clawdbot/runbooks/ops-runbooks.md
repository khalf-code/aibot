# Ops Runbooks — Business Skill Packs

Runbooks for all Ops workflows in the Clawdbot Business Skill Packs.

Covers:

- BIZ-067 (#158) Rotate credentials reminder docs + runbook
- BIZ-069 (#161) Onboard new employee checklist docs + runbook
- BIZ-072 (#164) Vendor renewal tracker update docs + runbook
- BIZ-075 (#167) Website uptime monitor response docs + runbook

---

## Rotate Credentials Reminder

**Workflow ID:** `ops-rotate-credentials`
**Trigger:** Scheduled (daily at 06:00 UTC) or manual
**Approval gate:** Ops engineer or security lead

### Overview

Scans all configured services for credentials (API keys, OAuth tokens, database passwords, SSH keys, TLS certificates, signing secrets) that have exceeded their maximum allowed age. Generates a rotation plan and pauses for Ops approval before executing rotations.

### Prerequisites

- Credential inventory configured in Clawdbot settings (service name, credential type, max age policy)
- Rotation scripts or API integrations available for each credential type
- Notification channel configured (e.g. `slack:#ops-alerts`)

### Steps

1. **Scan credentials** -- Query the credential inventory for all tracked credentials and their last rotation dates.
2. **Evaluate age** -- Compare each credential's age against its max-age policy. Flag credentials that are overdue.
3. **Generate rotation plan** -- Produce a plan listing which credentials to rotate, in what order, and what method to use.
4. **Approval gate** -- Pause for Ops approval. The reviewer sees the rotation plan, urgency level, and affected services.
5. **Execute rotation** -- Run rotation scripts or API calls for each approved credential.
6. **Verify rotation** -- Confirm the new credentials work (health checks, test connections).
7. **Notify owners** -- Send notifications to credential owners with rotation confirmation.
8. **Update audit log** -- Record the rotation event in the audit trail.

### Failure handling

- If rotation fails for a credential, the workflow marks it as failed and continues with the next credential.
- Failed rotations trigger an alert to the on-call channel.
- Retry policy: 3 attempts with exponential backoff for API-based rotations.

### Rollback

- If verification fails after rotation, the workflow does **not** automatically roll back (credentials may already be in use). Instead, it alerts the on-call team with the old and new credential references.

---

## Onboard New Employee Checklist

**Workflow ID:** `ops-onboard-employee`
**Trigger:** Manual (initiated by HR or hiring manager) or webhook from HRIS
**Approval gate:** Hiring manager

### Overview

Generates a department-specific onboarding checklist for a new hire, provisions accounts, orders hardware, schedules orientation, assigns a buddy, and sends a welcome email. Pauses for hiring manager approval after generating the checklist and before provisioning begins.

### Prerequisites

- Employee details available (name, email, department, start date, job title)
- Account provisioning integrations configured (Google Workspace, GitHub, Slack, etc.)
- Hardware ordering system connected (or manual process documented)
- Buddy assignment pool configured per department

### Steps

1. **Gather employee info** -- Collect new hire details from the trigger payload or HRIS webhook.
2. **Generate checklist** -- Build a department-specific task list (IT accounts, hardware, orientation, training).
3. **Approval gate** -- Pause for hiring manager review. The manager can add/remove tasks before approving.
4. **Provision accounts** -- Create accounts in configured systems (email, code repos, messaging, project tools).
5. **Order hardware** -- Submit hardware request through the ordering system.
6. **Schedule orientation** -- Book orientation sessions on the new hire's first week calendar.
7. **Assign buddy** -- Select and notify a buddy from the department pool.
8. **Send welcome email** -- Send the new hire a welcome email with first-day instructions.
9. **Notify team** -- Alert the team channel about the upcoming new hire.

### Failure handling

- Account provisioning failures are retried once; if still failing, the task is marked incomplete and the hiring manager is notified.
- Hardware ordering failures create a manual follow-up task in the checklist.

### Rollback

- If the workflow is cancelled after partial provisioning, created accounts should be manually disabled. The workflow logs all provisioned accounts for easy cleanup.

---

## Vendor Renewal Tracker Update

**Workflow ID:** `ops-vendor-renewal`
**Trigger:** Scheduled (weekly on Monday at 08:00 UTC) or manual
**Approval gate:** Finance lead or procurement manager

### Overview

Fetches vendor contract data from the contract management system, identifies contracts expiring within the look-ahead window, calculates spend impact, and updates the renewal tracker. Pauses for approval before writing updates to ensure data accuracy.

### Prerequisites

- Contract management system integration configured
- Vendor renewal tracker (spreadsheet, database, or dashboard) write access
- Look-ahead window and minimum contract value thresholds configured

### Steps

1. **Fetch contracts** -- Pull all active vendor contracts from the contract management system.
2. **Check expiry dates** -- Identify contracts expiring within the configured look-ahead window.
3. **Calculate spend** -- Compute the total annual value of expiring contracts and flag high-value renewals.
4. **Approval gate** -- Pause for finance/procurement review. The reviewer sees the list of expiring contracts, total exposure, and urgency.
5. **Update tracker** -- Write the approved renewal data to the tracker system.
6. **Notify procurement** -- Send alerts to the procurement team for contracts requiring negotiation.
7. **Generate report** -- Produce a summary report of upcoming renewals and actions needed.

### Failure handling

- Data fetch failures from the contract system are retried 3 times with exponential backoff.
- Tracker update failures trigger an alert and leave the workflow in a failed state for manual intervention.

### Rollback

- Tracker updates are versioned; previous state can be restored from the tracker's change history.

---

## Website Uptime Monitor Response

**Workflow ID:** `ops-uptime-monitor`
**Trigger:** Event-driven (uptime monitor alert) or webhook
**Approval gate:** Ops engineer or SRE on-call

### Overview

Responds to website uptime incidents by assessing severity, proposing a remediation action (restart, scale up, failover, rollback, page on-call, toggle feature flag), and executing the approved action. Pauses for Ops approval before destructive actions; info-level incidents can be auto-approved.

### Prerequisites

- Uptime monitoring system integration configured (e.g. Pingdom, UptimeRobot, custom)
- Remediation scripts or API integrations for each response action
- Status page integration configured
- On-call rotation and notification channel configured

### Steps

1. **Detect incident** -- Receive the uptime alert and extract incident details (endpoint, HTTP status, response time, consecutive failures).
2. **Assess severity** -- Classify the incident as info, warning, error, or critical based on failure patterns.
3. **Propose action** -- Select the most appropriate remediation action based on severity and incident type.
4. **Approval gate** -- Pause for Ops approval. Auto-approve is available for info-level incidents if configured.
5. **Execute remediation** -- Run the approved action (service restart, scale-up, failover, rollback, feature flag toggle, or page on-call).
6. **Verify recovery** -- Check the affected endpoint to confirm service recovery.
7. **Update status page** -- Post an update to the public status page reflecting the incident and resolution.
8. **Notify stakeholders** -- Send a summary to the stakeholder notification channel.
9. **Create postmortem** -- For error/critical incidents, generate a postmortem document template.

### Failure handling

- If remediation fails, the workflow pages the on-call team immediately.
- Recovery verification is retried up to 5 times with 30-second intervals.
- Status page updates use a notification retry policy (1 retry).

### Rollback

- Rollback actions (deploy rollback, feature flag revert) are themselves remediation options and can be triggered as follow-up actions if the initial remediation worsens the situation.
